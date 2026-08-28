"""
app/schemas/pydantic_models.py
------------------------------
Pydantic data validation models for FastAPI request and response payloads.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

# Citizen Soil-Moisture Feedback
class CitizenFeedbackCreate(BaseModel):
    water_body_id: str = Field(..., description="Unique ID of target water body")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude of observation point")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude of observation point")
    moisture_status: str = Field(..., description="Soil moisture level: DRY, OPTIMAL, or WATERLOGGED")
    observation_note: Optional[str] = Field(None, max_length=500, description="Field notes or comments")
    reporter_name: Optional[str] = Field("Anonymous Citizen", max_length=100)

    @field_validator("moisture_status")
    def validate_moisture(cls, v):
        allowed = {"DRY", "OPTIMAL", "WATERLOGGED"}
        if v.upper() not in allowed:
            raise ValueError(f"moisture_status must be one of {allowed}")
        return v.upper()

class CitizenFeedbackResponse(BaseModel):
    id: int
    water_body_id: str
    latitude: float
    longitude: float
    moisture_status: str
    observation_note: Optional[str]
    reporter_name: str
    created_at: str

# Admin Task Assignment
class OfficerTaskCreate(BaseModel):
    water_body_id: str = Field(..., description="Target water body ID")
    officer_name: str = Field(..., min_length=2, description="Assigned officer name")
    priority: str = Field("HIGH", description="Priority level: HIGH, MEDIUM, LOW")
    task_description: str = Field(..., min_length=5, description="Instructions for physical verification")

    @field_validator("priority")
    def validate_priority(cls, v):
        allowed = {"HIGH", "MEDIUM", "LOW"}
        if v.upper() not in allowed:
            raise ValueError(f"priority must be one of {allowed}")
        return v.upper()

class OfficerTaskResponse(BaseModel):
    task_id: int
    water_body_id: str
    officer_name: str
    priority: str
    task_description: str
    status: str
    assigned_at: str

# Contextual Indicator Assessment Profile
class ContextualAssessment(BaseModel):
    status_classification: str
    spatial_associations: List[str]
    scientific_disclaimer: str
    surrounding_indicators: Dict[str, Any]
    recommended_interventions: List[str]

# Water Body Temporal Analysis Response
class TemporalObservationItem(BaseModel):
    observation_date: str
    area_ha: float
    source: str

class GeoCodedPhotoItem(BaseModel):
    id: int
    photo_url: str
    latitude: float
    longitude: float
    caption: str
    captured_at: str

class WaterBodyAnalysisResponse(BaseModel):
    water_body_id: str
    name: str
    category: str
    baseline_area_ha: float
    current_area_ha: float
    area_change_pct: float
    status: str
    assessment: ContextualAssessment
    temporal_observations: List[TemporalObservationItem]
    recent_citizen_feedback: List[CitizenFeedbackResponse]
    geo_coded_photos: List[GeoCodedPhotoItem]

# Officer Alert Response
class AlertItemResponse(BaseModel):
    alert_id: int
    water_body_id: str
    water_body_name: str
    area_change_pct: float
    severity: str
    alert_message: str
    created_at: str
    assigned_task: Optional[OfficerTaskResponse] = None
