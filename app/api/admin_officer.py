"""
app/api/admin_officer.py
-------------------------
Admin and Officer endpoints protected by RBAC dependencies (`require_admin`, `require_officer`, `get_current_user`).
Includes Activity Audit Logging for Admin actions and system oversight.
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status, Query
from app.database.spatialite import (
    insert_officer_task,
    get_active_alerts,
    complete_officer_task,
    get_approved_officers,
    get_all_completed_reports,
    log_activity,
    get_activity_logs
)
from app.security import require_admin, require_officer, get_current_user

router = APIRouter(tags=["Admin & Officer Management"])
logger = logging.getLogger("app.api.admin_officer")

class TaskAssignmentRequest(BaseModel):
    water_body_id: str = Field(..., description="ID of target water body to verify")
    officer_name: str = Field(..., description="Name or UID of assigned officer")
    priority: str = Field("HIGH", description="Priority level: HIGH, MEDIUM, LOW")
    task_description: str = Field(..., description="Detailed instructions for field verification")

from app.graph.neo4j_driver import sync_officer_task_to_neo4j

@router.post(
    "/admin/assign-task",
    summary="Assign Field Verification Task to Officer (Admin Only)"
)
def assign_verification_task(
    payload: TaskAssignmentRequest,
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Allows Admins to dispatch field verification tasks for shrinking water bodies.
    Executes Dual-Store Write:
      1. Inserts transactional task record into SQLite officer_tasks table.
      2. Synchronizes (:TaskNode), (:Officer)-[:ASSIGNED_TO]->(:TaskNode)-[:ASSOCIATED_WITH]->(:WaterBody) node/edges in Neo4j property graph.
    """
    try:
        task_dict = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        task_id = insert_officer_task(task_dict)
        
        # Real-time dynamic dual-store graph binding in Neo4j
        neo4j_synced = sync_officer_task_to_neo4j(
            officer_name_or_email=payload.officer_name,
            wb_id=payload.water_body_id,
            task_id=task_id,
            priority=payload.priority,
            status="PENDING",
            task_description=payload.task_description
        )

        # Audit log entry
        log_activity(
            user_email=admin_user.get("email", "admin@watershed.tn.gov.in"),
            user_role="ADMIN",
            action_category="ADMIN",
            action_type="TASK_DISPATCH",
            description=f"Dispatched Task #{task_id} ({payload.priority} Priority) for Water Body #{payload.water_body_id} to Officer '{payload.officer_name}' [Neo4j Synced: {neo4j_synced}]",
            target_id=payload.water_body_id
        )

        logger.info(f"Admin '{admin_user.get('email')}' assigned task #{task_id} to officer '{payload.officer_name}' (Neo4j: {neo4j_synced}).")
        return {
            "status": "PENDING",
            "task_id": task_id,
            "water_body_id": payload.water_body_id,
            "officer_name": payload.officer_name,
            "priority": payload.priority,
            "task_description": payload.task_description,
            "assigned_by": admin_user.get("email"),
            "neo4j_synced": neo4j_synced,
            "message": f"Task #{task_id} dispatched to Officer {payload.officer_name} & written to dual stores (SQLite + Neo4j)."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during dual-store task dispatch transaction: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Dual-store task dispatch transaction failed: {str(e)}"
        )

@router.get(
    "/admin/approved-officers",
    summary="Get List of Approved Field Officers (Admin & Officer)"
)
def fetch_approved_officers(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns list of verified active field officers available for task assignment from SQLite users table.
    """
    officers = get_approved_officers()
    logger.info(f"[DIAGNOSTIC LOG] fetch_approved_officers called by '{current_user.get('email')}'. Retrieved {len(officers)} officers from SQLite users table.")
    return officers

@router.get(
    "/admin/activity-logs",
    summary="Get System Activity Audit Logs (Admin Only)"
)
def fetch_activity_logs(
    category: Optional[str] = Query("ALL", description="Filter by category: 'ALL', 'ADMIN', 'OFFICER', 'CITIZEN'"),
    limit: int = Query(100, description="Max logs to return"),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Returns filterable chronological audit logs of all administrative dispatches, officer inspection reports, and citizen field telemetry.
    Strictly protected by `require_admin`.
    """
    logs = get_activity_logs(category=category, limit=limit)
    return logs

@router.get(
    "/admin/all-reports",
    summary="Get Audit Log of All Field Reports (Admin Only)"
)
def fetch_all_reports(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Returns audit log of all field verification tasks and officer submissions.
    Strictly protected by `require_admin`.
    """
    reports = get_all_completed_reports()
    return reports

@router.get(
    "/officer/alerts",
    summary="Get Active Critical Alerts (Officer & Admin)"
)
def fetch_officer_alerts(current_user: Dict[str, Any] = Depends(require_officer)):
    """
    Returns active critical alerts requiring field verification.
    Accessible by approved OFFICER or ADMIN roles.
    """
    alerts = get_active_alerts()
    return alerts

from app.graph.neo4j_bulk_loader import run_neo4j_bulk_ingestion

@router.post(
    "/admin/seed-neo4j",
    summary="Trigger Bulk Ingestion of GeoJSON Datasets into Neo4j (Admin Only)"
)
def trigger_neo4j_bulk_seed(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Triggers Cypher UNWIND bulk loading of Coimbatore watershed & water body GeoJSON datasets into Neo4j.
    Strictly protected by `require_admin`. Logs action to audit trail.
    """
    result = run_neo4j_bulk_ingestion()
    
    log_activity(
        user_email=admin_user.get("email", "admin@watershed.tn.gov.in"),
        user_role="ADMIN",
        action_category="ADMIN",
        action_type="NEO4J_BULK_SEED",
        description=f"Triggered Neo4j Cypher UNWIND Bulk Seeding ({result.get('status')})",
        target_id="NEO4J_GRAPH"
    )
    
    logger.info(f"Admin '{admin_user.get('email')}' executed Neo4j bulk seed operation.")
    return result

from app.database.spatialite import get_db_connection

@router.get(
    "/admin/sql/tables-summary",
    summary="Get Primary SQL Database Tables Summary & Row Counts (Admin Only)"
)
def get_sql_tables_summary(admin_user: Dict[str, Any] = Depends(require_admin)):
    """
    Returns summary metadata and live row counts for primary SQL database tables.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    tables_meta = [
        {"name": "water_bodies", "description": "Master water body spatial entities, current spread area & temporal status"},
        {"name": "watersheds", "description": "Official watershed basin boundary geometries and catchment area metrics"},
        {"name": "users", "description": "User accounts, authentication credentials, and RBAC roles"},
        {"name": "officer_tasks", "description": "Field verification task dispatches, priority levels & status"},
        {"name": "citizen_feedback", "description": "Ground soil moisture observations and citizen field reports"},
        {"name": "geo_coded_photos", "description": "Field inspection photo evidence with spatial GPS coordinates"},
        {"name": "activity_logs", "description": "Audit trail of administrative dispatches, logins, and system events"}
    ]

    result_tables = []
    for t in tables_meta:
        tbl_name = t["name"]
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {tbl_name}")
            cnt = cursor.fetchone()[0]
        except Exception:
            cnt = 0
        result_tables.append({
            "name": tbl_name,
            "row_count": cnt,
            "description": t["description"]
        })

    conn.close()

    return {
        "status": "SUCCESS",
        "database_type": "SQLite Spatial Transactional Store",
        "tables": result_tables
    }

@router.get(
    "/admin/sql/table-data",
    summary="Get Table Rows from SQL Database (Admin Only)"
)
def get_sql_table_data(
    table_name: str = Query("activity_logs", description="Target SQL table name"),
    limit: int = Query(50, description="Max rows to fetch"),
    admin_user: Dict[str, Any] = Depends(require_admin)
):
    """
    Returns row data from specified SQL database table.
    Properly fetches and displays active rows from officer_tasks sorted by task_id DESC.
    """
    allowed_tables = {"water_bodies", "watersheds", "users", "officer_tasks", "citizen_feedback", "geo_coded_photos", "activity_logs"}
    if table_name not in allowed_tables:
        raise HTTPException(status_code=400, detail=f"Invalid table name '{table_name}'. Allowed tables: {list(allowed_tables)}")

    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        if table_name == "water_bodies":
            cursor.execute("SELECT wb_id, wetcode, name, category, watershed_id, baseline_area_ha, current_area_ha, area_change_pct, status, latitude, longitude FROM water_bodies LIMIT ?", (limit,))
        elif table_name == "officer_tasks":
            cursor.execute("SELECT task_id, wb_id, officer_name, priority, task_description, status, verification_findings, photo_url, moisture_status, assigned_at, completed_at FROM officer_tasks ORDER BY task_id DESC LIMIT ?", (limit,))
        elif table_name == "users":
            cursor.execute("SELECT id, username, email, name, role, approval_status, created_at FROM users ORDER BY id DESC LIMIT ?", (limit,))
        else:
            cursor.execute(f"SELECT * FROM {table_name} ORDER BY rowid DESC LIMIT ?", (limit,))
        
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        
        result_rows = []
        for r in rows:
            result_rows.append(dict(zip(columns, r)))

        conn.close()
        return {
            "status": "SUCCESS",
            "table_name": table_name,
            "columns": columns,
            "row_count": len(result_rows),
            "data": result_rows
        }
    except Exception as e:
        conn.close()
        logger.error(f"Error fetching SQL table data for '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch table data: {str(e)}")


