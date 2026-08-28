"""
app/main.py
-----------
FastAPI main application entry point, static files mount, and router configuration.
"""

import os
import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import water_bodies, watersheds, analysis, feedback, admin_officer, auth, tasks, citizen
from app.database.spatialite import get_db_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")

from contextlib import asynccontextmanager
from app.graph.neo4j_driver import check_neo4j_health
from app.graph.neo4j_bulk_loader import run_neo4j_bulk_ingestion

from app.database.spatialite import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager initializing SQLite schema and verifying Neo4j connectivity."""
    try:
        init_db()
        logger.info("SQLite database schema initialized and migrated successfully on startup.")
    except Exception as e:
        logger.error(f"Error initializing SQLite database schema on startup: {e}")

    health = check_neo4j_health()
    if health.get("connected", False):
        logger.info("Neo4j database detected ONLINE. Executing startup bulk dataset ingestion...")
        res = run_neo4j_bulk_ingestion()
        logger.info(f"Startup Neo4j bulk ingestion result: {res.get('status')}")
    else:
        logger.info("Neo4j database offline during startup. Using SQLite spatial fallback engine.")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SIH Prototype: Geo-Spatial Visualization and Temporal Interpretation of Water Bodies (Coimbatore District, TN)",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from app.database.spatialite import log_activity

@app.middleware("http")
async def audit_trail_middleware(request: Request, call_next):
    """Middleware writing transactional audit trails to SQLite database for reliable logging and debugging."""
    response = await call_next(request)
    
    if request.method in ["POST", "PUT", "DELETE"] and response.status_code in [200, 201]:
        path = request.url.path
        if "/api/auth/login" in path:
            log_activity(
                user_email="auth.user",
                user_role="USER",
                action_category="AUTH",
                action_type="LOGIN_SUCCESS",
                description=f"User login request processed successfully on {path}"
            )
        elif "/api/admin/assign-task" in path:
            log_activity(
                user_email="admin@watershed.tn.gov.in",
                user_role="ADMIN",
                action_category="ADMIN",
                action_type="TASK_DISPATCH",
                description=f"Admin field verification task dispatch processed on {path}"
            )
        elif "/api/citizen/feedback" in path:
            log_activity(
                user_email="citizen@watershed.tn.gov.in",
                user_role="CITIZEN",
                action_category="CITIZEN",
                action_type="TELEMETRY_SUBMISSION",
                description=f"Citizen soil moisture observation submitted on {path}"
            )
        elif "/api/admin/seed-neo4j" in path:
            log_activity(
                user_email="admin@watershed.tn.gov.in",
                user_role="ADMIN",
                action_category="ADMIN",
                action_type="HYBRID_NEO4J_SYNC",
                description=f"Hybrid Neo4j dataset sync operation executed on {path}"
            )
    return response

UPLOAD_DIR = Path("datas/evidence_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/evidence_uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="evidence_uploads")

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(water_bodies.router, prefix=settings.API_V1_STR)
app.include_router(watersheds.router, prefix=settings.API_V1_STR)
app.include_router(analysis.router, prefix=settings.API_V1_STR)
app.include_router(feedback.router, prefix=settings.API_V1_STR)
app.include_router(admin_officer.router, prefix=settings.API_V1_STR)
app.include_router(tasks.router, prefix=settings.API_V1_STR)
app.include_router(citizen.router, prefix=settings.API_V1_STR)

@app.get("/health/neo4j", summary="Neo4j Integration Health Check", tags=["System Health"])
@app.get("/api/health/neo4j", summary="Neo4j Integration Health Check", tags=["System Health"])
@app.get("/api/v1/health/neo4j", summary="Neo4j Integration Health Check", tags=["System Health"])
def health_neo4j():
    """
    Verifies Neo4j Database connectivity using get_neo4j_driver().
    Returns status: ONLINE when Neo4j is connected, or status: FALLBACK when offline.
    """
    return check_neo4j_health()

@app.get("/", summary="System Health & API Information")
def root():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM water_bodies")
    total_wb = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) as total FROM alerts WHERE status = 'ACTIVE'")
    active_alerts = cursor.fetchone()["total"]
    conn.close()

    neo4j_health = check_neo4j_health()

    return {
        "status": "ONLINE",
        "project": settings.PROJECT_NAME,
        "study_area": "Coimbatore District, Tamil Nadu",
        "metric_crs": settings.METRIC_CRS,
        "total_water_bodies_tracked": total_wb,
        "active_critical_alerts": active_alerts,
        "neo4j_status": neo4j_health["status"],
        "auth_enabled": True,
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
