"""
app/api/feedback.py
-------------------
Endpoint for citizens and local farmers to submit ground soil moisture feedback.
"""

import logging
from fastapi import APIRouter, HTTPException
from app.schemas.pydantic_models import CitizenFeedbackCreate, CitizenFeedbackResponse
from app.database.spatialite import insert_citizen_feedback, get_water_body_details

router = APIRouter(prefix="/feedback", tags=["Citizen Feedback"])
logger = logging.getLogger("app.api.feedback")

@router.post("/soil-moisture", summary="Submit Citizen Soil Moisture Feedback", response_model=CitizenFeedbackResponse)
def submit_soil_moisture_feedback(payload: CitizenFeedbackCreate):
    """
    Receives citizen/farmer soil moisture tracking (DRY, OPTIMAL, WATERLOGGED)
    with GPS coordinates and observation notes.
    """
    wb = get_water_body_details(payload.water_body_id)
    if not wb:
        raise HTTPException(status_code=404, detail=f"Water Body ID '{payload.water_body_id}' not found.")

    feedback_data = payload.model_dump()
    try:
        feedback_id = insert_citizen_feedback(feedback_data)
        logger.info(f"Recorded feedback #{feedback_id} for water body {payload.water_body_id}.")
        return CitizenFeedbackResponse(
            id=feedback_id,
            water_body_id=payload.water_body_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            moisture_status=payload.moisture_status,
            observation_note=payload.observation_note,
            reporter_name=payload.reporter_name or "Anonymous Citizen",
            created_at="Just now"
        )
    except Exception as e:
        logger.error(f"Error submitting citizen feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to record citizen feedback.")
