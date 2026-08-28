"""
app/api/citizen.py
-------------------
Citizen Reporting & Ground Telemetry Router with Activity Audit Logging.
"""

import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status
from app.database.spatialite import (
    insert_citizen_feedback,
    get_citizen_feedback_by_user,
    log_activity
)
from app.security import require_citizen, get_current_user

router = APIRouter(tags=["Citizen Field Telemetry"])
logger = logging.getLogger("app.api.citizen")

class CitizenFeedbackRequest(BaseModel):
    water_body_id: str = Field(..., description="ID of target water body")
    latitude: float = Field(..., description="GPS Latitude coordinate")
    longitude: float = Field(..., description="GPS Longitude coordinate")
    moisture_status: str = Field(..., description="'DRY', 'MODERATE', 'OPTIMAL', 'SATURATED'")
    observation_note: Optional[str] = Field(None, description="Field notes on crop health or water level")
    photo_url: Optional[str] = Field(None, description="Uploaded photo evidence URL")
    reporter_name: Optional[str] = Field("Anonymous Citizen", description="Name of reporting citizen")

from app.graph.neo4j_driver import sync_evidence_log_to_neo4j

@router.post(
    "/citizen/feedback",
    summary="Submit Soil Moisture & Field Observation (Citizen)"
)
def submit_feedback(
    payload: CitizenFeedbackRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submits citizen field observation and soil moisture telemetry to SQLite database.
    Logs action to activity_logs table and syncs to Neo4j graph DB in real time.
    """
    fb_dict = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    feedback_id = insert_citizen_feedback(fb_dict)
    
    # Real-time synchronization creating/linking EvidenceLog node in Neo4j
    sync_evidence_log_to_neo4j(
        evidence_id=f"FB_{feedback_id}",
        wb_id=payload.water_body_id,
        ev_type="CITIZEN_FEEDBACK",
        reporter_name=payload.reporter_name or "Citizen",
        note=payload.observation_note or f"Soil Moisture Observation: {payload.moisture_status}",
        photo_url=payload.photo_url or "",
        moisture_status=payload.moisture_status
    )
    
    # Audit log entry for citizen feedback
    log_activity(
        user_email=current_user.get("email", "citizen@watershed.tn.gov.in"),
        user_role="CITIZEN",
        action_category="CITIZEN",
        action_type="FEEDBACK_SUBMISSION",
        description=f"Citizen '{payload.reporter_name}' submitted Soil Moisture Observation for Water Body #{payload.water_body_id} (Status: {payload.moisture_status})",
        target_id=payload.water_body_id
    )

    logger.info(f"Citizen '{current_user.get('email')}' submitted field feedback #{feedback_id} for Water Body '{payload.water_body_id}'.")
    return {
        "status": "SUCCESS",
        "feedback_id": feedback_id,
        "message": "Field observation and soil moisture data successfully submitted."
    }

@router.get(
    "/citizen/my-submissions",
    summary="Get Citizen Submission Audit Log"
)
def fetch_my_submissions(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns audit history of past observations submitted by the logged in citizen.
    """
    reporter_name = current_user.get("name") or current_user.get("email", "").split("@")[0]
    submissions = get_citizen_feedback_by_user(reporter_name=reporter_name)
    return submissions
