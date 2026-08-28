"""
app/api/watersheds.py
---------------------
Endpoint for retrieving Coimbatore Watershed Catchment Boundaries GeoJSON.
"""

import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.config import settings

router = APIRouter(prefix="/watersheds", tags=["Watershed Catchments"])
logger = logging.getLogger("app.api.watersheds")

WATERSHEDS_GEOJSON_PATH = settings.GEOJSON_PATH.parent / "coimbatore_watersheds.geojson"

@router.get("", summary="Get Coimbatore Watershed Catchments GeoJSON")
def get_watersheds():
    """
    Returns GeoJSON FeatureCollection of major Coimbatore watershed catchment boundaries.
    """
    if not WATERSHEDS_GEOJSON_PATH.exists():
        raise HTTPException(status_code=4404, detail="Watershed catchments GeoJSON not found. Run generate_watersheds.py script.")

    try:
        with open(WATERSHEDS_GEOJSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info(f"Loaded watershed catchments GeoJSON ({len(data.get('features', []))} features).")
        return data
    except Exception as e:
        logger.error(f"Error loading watershed catchments GeoJSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to load watershed boundaries.")
