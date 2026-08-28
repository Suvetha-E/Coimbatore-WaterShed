"""
app/api/water_bodies.py
-----------------------
Endpoint for fetching Coimbatore water bodies GeoJSON FeatureCollection.
Supports optional filtering by watershed_id.
"""

import json
import logging
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from app.database.spatialite import get_db_connection

router = APIRouter(prefix="/water-bodies", tags=["Water Bodies"])
logger = logging.getLogger("app.api.water_bodies")

@router.get("", summary="Get Coimbatore Water Bodies GeoJSON")
def get_water_bodies(
    watershed_id: Optional[str] = Query(None, description="Optional watershed ID to filter water bodies (e.g. WS_NOYYAL_01)")
):
    """
    Returns GeoJSON FeatureCollection of Coimbatore water bodies with temporal status and area properties.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    if watershed_id:
        cursor.execute("""
            SELECT wb_id, wetcode, name, category, watershed_id, baseline_area_ha, current_area_ha, area_change_pct, status, latitude, longitude, geometry_json
            FROM water_bodies
            WHERE watershed_id = ?
        """, (watershed_id,))
    else:
        cursor.execute("""
            SELECT wb_id, wetcode, name, category, watershed_id, baseline_area_ha, current_area_ha, area_change_pct, status, latitude, longitude, geometry_json
            FROM water_bodies
        """)

    rows = cursor.fetchall()
    conn.close()

    features = []
    for r in rows:
        try:
            geom = json.loads(r["geometry_json"])
        except Exception:
            geom = None

        if geom:
            feat = {
                "type": "Feature",
                "properties": {
                    "wb_id": r["wb_id"],
                    "wetcode": r["wetcode"],
                    "name": r["name"] or "Unnamed Water Body",
                    "category": r["category"],
                    "watershed_id": r["watershed_id"] or "WS_NOYYAL_01",
                    "baseline_area_ha": r["baseline_area_ha"],
                    "current_area_ha": r["current_area_ha"],
                    "area_change_pct": r["area_change_pct"],
                    "status": r["status"],
                    "latitude": r["latitude"],
                    "longitude": r["longitude"]
                },
                "geometry": geom
            }
            features.append(feat)

    logger.info(f"Returning GeoJSON FeatureCollection with {len(features)} features (Filter watershed_id: {watershed_id}).")
    return {
        "type": "FeatureCollection",
        "features": features
    }
