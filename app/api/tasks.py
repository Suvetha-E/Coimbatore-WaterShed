"""
app/api/tasks.py
----------------
Officer Task & Field Verification Endpoints with Evidence Uploads & Activity Audit Logging.
"""

import os
import shutil
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from app.database.spatialite import (
    get_officer_tasks,
    submit_officer_inspection_report,
    log_activity
)
from app.security import require_officer, get_current_user

router = APIRouter(tags=["Officer Field Tasks"])
logger = logging.getLogger("app.api.tasks")

UPLOAD_DIR = Path("datas/evidence_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class InspectionReportRequest(BaseModel):
    verification_findings: str = Field(..., description="Physical verification findings")
    moisture_status: Optional[str] = Field("OPTIMAL", description="Soil moisture assessment")
    photo_url: Optional[str] = Field(None, description="Local or remote photo evidence URL")

class TaskAssignmentRequest(BaseModel):
    water_body_id: str = Field(..., description="ID of target water body to verify")
    officer_name: str = Field(..., description="Name or UID of assigned officer")
    priority: str = Field("HIGH", description="Priority level: HIGH, MEDIUM, LOW")
    task_description: str = Field(..., description="Detailed instructions for field verification")

@router.get(
    "/tasks/list",
    summary="Get List of All Tasks for Relational SQL Viewer"
)
@router.get(
    "/tasks/all",
    summary="Get List of All Tasks"
)
@router.get(
    "/admin/tasks",
    summary="Get All Dispatched Officer Tasks"
)
def fetch_tasks_list(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns all task records from officer_tasks for the relational SQL database viewer.
    Populates table rows dynamically and resolves the 0 records shown empty state.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT 
                t.task_id,
                t.wb_id,
                t.officer_name,
                t.priority,
                t.task_description,
                t.status,
                t.verification_findings,
                t.photo_url,
                t.moisture_status,
                t.assigned_at,
                t.completed_at,
                COALESCE(wb.name, 'Unnamed Water Body') as water_body_name,
                wb.category,
                wb.latitude,
                wb.longitude
            FROM officer_tasks t
            LEFT JOIN water_bodies wb ON t.wb_id = wb.wb_id
            ORDER BY t.task_id DESC
        """)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        result_rows = [dict(zip(columns, r)) for r in rows]
        return {
            "status": "SUCCESS",
            "table_name": "officer_tasks",
            "count": len(result_rows),
            "columns": columns,
            "data": result_rows
        }
    except Exception as e:
        logger.error(f"Error fetching task list: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch task list: {str(e)}")
    finally:
        conn.close()

from app.database.spatialite import insert_officer_task
from app.graph.neo4j_driver import sync_officer_task_to_neo4j

@router.post(
    "/tasks/assign",
    summary="Assign Field Verification Task to Officer (Dual-Store Write)"
)
def assign_task_endpoint(
    payload: TaskAssignmentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Executes Dual-Store Task Dispatch:
    1. SQLite atomic insert into officer_tasks.
    2. Neo4j graph binding: (:TaskNode), (:Officer)-[:ASSIGNED_TO]->(:TaskNode)-[:ASSOCIATED_WITH]->(:WaterBody).
    """
    try:
        task_dict = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
        task_id = insert_officer_task(task_dict)
        
        neo4j_synced = sync_officer_task_to_neo4j(
            officer_name_or_email=payload.officer_name,
            wb_id=payload.water_body_id,
            task_id=task_id,
            priority=payload.priority,
            status="PENDING",
            task_description=payload.task_description
        )

        log_activity(
            user_email=current_user.get("email", "admin@watershed.tn.gov.in"),
            user_role=current_user.get("role", "ADMIN"),
            action_category="ADMIN",
            action_type="TASK_DISPATCH",
            description=f"Dispatched Task #{task_id} ({payload.priority} Priority) for Water Body #{payload.water_body_id} to Officer '{payload.officer_name}' [Neo4j Synced: {neo4j_synced}]",
            target_id=payload.water_body_id
        )

        return {
            "status": "PENDING",
            "task_id": task_id,
            "water_body_id": payload.water_body_id,
            "officer_name": payload.officer_name,
            "priority": payload.priority,
            "task_description": payload.task_description,
            "assigned_by": current_user.get("email"),
            "neo4j_synced": neo4j_synced,
            "message": f"Task #{task_id} dispatched to Officer {payload.officer_name} & written to dual stores (SQLite + Neo4j)."
        }
    except Exception as e:
        logger.error(f"Error during task dispatch transaction: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Dual-store task dispatch transaction failed: {str(e)}"
        )

@router.get(
    "/officer/tasks",
    summary="Get Assigned Inspection Tasks (Officer & Admin)"
)
def fetch_assigned_tasks(current_user: Dict[str, Any] = Depends(require_officer)):
    """
    Returns field inspection tasks assigned to the current officer.
    """
    officer_name = current_user.get("name") or current_user.get("email", "").split("@")[0]
    tasks = get_officer_tasks(officer_name=officer_name)
    logger.info(f"Officer '{officer_name}' fetched {len(tasks)} assigned inspection tasks.")
    return tasks

from app.database.spatialite import get_db_connection
from app.graph.neo4j_driver import sync_evidence_log_to_neo4j

@router.post(
    "/officer/submit-report/{task_id}",
    summary="Submit Field Verification Report (Officer Only)"
)
def submit_report(
    task_id: int,
    payload: InspectionReportRequest,
    current_user: Dict[str, Any] = Depends(require_officer)
):
    """
    Submits on-site physical verification findings and completes task #task_id.
    Logs action to activity_logs table and syncs EvidenceLog edge to Neo4j.
    """
    success = submit_officer_inspection_report(
        task_id=task_id,
        findings=payload.verification_findings,
        photo_url=payload.photo_url,
        moisture_status=payload.moisture_status
    )
    if not success:
        raise HTTPException(status_code=404, detail=f"Task #{task_id} not found.")

    # Retrieve water body ID for Neo4j dynamic binding
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT wb_id FROM officer_tasks WHERE task_id = ?", (task_id,))
    row = cursor.fetchone()
    wb_id = row["wb_id"] if row else "38295"
    conn.close()

    # Real-Time Neo4j Graph Synchronization
    sync_evidence_log_to_neo4j(
        evidence_id=f"TASK_{task_id}",
        wb_id=str(wb_id),
        ev_type="OFFICER_INSPECTION",
        reporter_name=current_user.get("name") or current_user.get("email") or "Field Officer",
        note=payload.verification_findings,
        photo_url=payload.photo_url or "",
        moisture_status=payload.moisture_status or "OPTIMAL"
    )

    # Audit log entry for officer inspection report submission
    log_activity(
        user_email=current_user.get("email", "officer@watershed.tn.gov.in"),
        user_role="OFFICER",
        action_category="OFFICER",
        action_type="INSPECTION_SUBMISSION",
        description=f"Officer '{current_user.get('name')}' submitted Inspection Findings for Task #{task_id} (Moisture: {payload.moisture_status})",
        target_id=str(task_id)
    )

    logger.info(f"Officer '{current_user.get('email')}' completed inspection task #{task_id} & synced Neo4j graph.")
    return {
        "status": "COMPLETED",
        "task_id": task_id,
        "message": f"Inspection report for Task #{task_id} successfully submitted."
    }

@router.post(
    "/officer/upload-evidence",
    summary="Upload On-Site Evidence Photo (Officer & Citizen)"
)
async def upload_evidence(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Saves uploaded evidence image to local storage and returns static file access URL.
    """
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    photo_url = f"/evidence_uploads/{filename}"
    
    log_activity(
        user_email=current_user.get("email", "user@watershed.tn.gov.in"),
        user_role=current_user.get("role", "OFFICER"),
        action_category=current_user.get("role", "OFFICER"),
        action_type="EVIDENCE_UPLOAD",
        description=f"Uploaded photo evidence '{filename}'",
        target_id=filename
    )

    logger.info(f"User '{current_user.get('email')}' uploaded photo evidence '{filename}'.")
    return {
        "status": "SUCCESS",
        "photo_url": photo_url,
        "filename": filename
    }
