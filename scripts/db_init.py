"""
db_init.py
----------
Initializes SQLite + SpatiaLite schema and seeds the database with clipped Coimbatore water bodies,
watershed catchments, multi-temporal observations with seasonality, active alerts, interventions, field photos, and sample citizen feedback.
"""

import sys
import json
import logging
import random
from pathlib import Path
from datetime import datetime, timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.config import settings
from app.database.spatialite import (
    init_db,
    get_db_connection
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("db_init")

GEOJSON_FILE = settings.GEOJSON_PATH
WATERSHEDS_GEOJSON = settings.GEOJSON_PATH.parent / "coimbatore_watersheds.geojson"

def seed_database():
    logger.info("Initializing SQLite database schema...")
    init_db()

    if not GEOJSON_FILE.exists():
        logger.error(f"Processed GeoJSON not found at {GEOJSON_FILE}. Run clip_water_bodies.py first.")
        sys.exit(1)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Clear existing records for clean re-seeding
    cursor.execute("DELETE FROM watersheds")
    cursor.execute("DELETE FROM water_bodies")
    cursor.execute("DELETE FROM water_body_observations")
    cursor.execute("DELETE FROM citizen_feedback")
    cursor.execute("DELETE FROM alerts")
    cursor.execute("DELETE FROM officer_tasks")
    cursor.execute("DELETE FROM interventions")
    cursor.execute("DELETE FROM geo_coded_photos")

    # 1. Seed Watersheds
    if WATERSHEDS_GEOJSON.exists():
        with open(WATERSHEDS_GEOJSON, "r", encoding="utf-8") as f:
            ws_data = json.load(f)
        for feat in ws_data.get("features", []):
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            cursor.execute("""
                INSERT INTO watersheds (watershed_id, name, district, river_basin, area_sqkm, geometry_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                props.get("watershed_id"),
                props.get("name"),
                props.get("district", "Coimbatore"),
                props.get("river_basin", "Noyyal"),
                props.get("area_sqkm", 100.0),
                json.dumps(geom)
            ))
        logger.info(f"Seeded {len(ws_data.get('features', []))} watershed catchments.")

    # 2. Seed Water Bodies
    logger.info(f"Loading GeoJSON data from {GEOJSON_FILE}...")
    with open(GEOJSON_FILE, "r", encoding="utf-8") as f:
        geojson_data = json.load(f)

    features = geojson_data.get("features", [])
    logger.info(f"Seeding database with {len(features)} water body features...")

    wb_count = 0
    obs_count = 0
    alerts_triggered = 0

    key_names = {
        "13734": "Sholaiar Reservoir",
        "38295": "Singanallur Lake",
        "38458": "Ukkadam Periyakulam",
        "7678": "Valankulam Lake",
        "9021": "Sulur Big Tank",
        "6302": "Kurichi Kulam"
    }

    random.seed(42)

    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        
        raw_id = str(props.get("wb_id") or props.get("id") or f"CBE_{wb_count+1:04d}")
        wetname = props.get("wetname")
        if not wetname or str(wetname) == "nan":
            wetname = key_names.get(raw_id, props.get("name", "Unnamed Water Body"))
            
        category = props.get("level_iii") or props.get("category", "Water Body / Reservoir")
        watershed_id = props.get("watershed_id", "WS_NOYYAL_01")
        baseline_ha = round(float(props.get("area_ha_calc") or props.get("baseline_area_ha") or 10.0), 4)

        rnd = random.random()
        if raw_id in ["38295", "7678"] or rnd < 0.08:
            area_change_pct = round(random.uniform(-45.0, -31.0), 2)
            status = "SIGNIFICANT_REDUCTION"
        elif rnd < 0.25:
            area_change_pct = round(random.uniform(-29.0, -11.0), 2)
            status = "MODERATE_REDUCTION"
        elif rnd < 0.35:
            area_change_pct = round(random.uniform(11.0, 35.0), 2)
            status = "EXPANDED"
        else:
            area_change_pct = round(random.uniform(-9.5, 9.5), 2)
            status = "NO_SIGNIFICANT_CHANGE"

        current_ha = round(baseline_ha * (1.0 + (area_change_pct / 100.0)), 4)
        if current_ha < 0.01:
            current_ha = 0.01

        coords = geom.get("coordinates", [])
        lat, lon = 11.01, 76.96
        try:
            if geom.get("type") == "Polygon" and coords:
                poly_pts = coords[0]
                lon = sum(p[0] for p in poly_pts) / len(poly_pts)
                lat = sum(p[1] for p in poly_pts) / len(poly_pts)
            elif geom.get("type") == "MultiPolygon" and coords:
                poly_pts = coords[0][0]
                lon = sum(p[0] for p in poly_pts) / len(poly_pts)
                lat = sum(p[1] for p in poly_pts) / len(poly_pts)
        except Exception:
            pass

        cursor.execute("""
            INSERT INTO water_bodies (wb_id, wetcode, name, category, watershed_id, baseline_area_ha, current_area_ha, area_change_pct, status, latitude, longitude, geometry_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            raw_id,
            str(props.get("wetcode", "1202")),
            wetname,
            str(category),
            watershed_id,
            baseline_ha,
            current_ha,
            area_change_pct,
            status,
            lat,
            lon,
            json.dumps(geom)
        ))
        wb_count += 1

        # Multi-temporal observations with acquisition dates and seasonality metadata
        obs_records = [
            ("2022-03-15", 3, "PRE_MONSOON", round(baseline_ha * 1.05, 4), 2.1, 0.95),
            ("2023-10-20", 10, "NORTHEAST_MONSOON", round(baseline_ha * 0.98, 4), 5.0, 0.92),
            ("2024-03-15", 3, "PRE_MONSOON", round(baseline_ha * (1.0 + (area_change_pct * 0.5 / 100.0)), 4), 1.5, 0.96),
            ("2026-03-15", 3, "PRE_MONSOON", current_ha, 0.5, 0.98)
        ]

        for dt, mth, ssn, ar, cld, conf in obs_records:
            cursor.execute("""
                INSERT INTO water_body_observations (wb_id, observation_date, acquisition_month, season, area_ha, cloud_cover_pct, confidence, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Sentinel-2 Remote Sensing')
            """, (raw_id, dt, mth, ssn, ar, cld, conf))
            obs_count += 1

        # Trigger automatic alert if change <= -30%
        if area_change_pct <= -30.0:
            msg = f"Critical shrinkage detected for '{wetname}' (ID: {raw_id}): area reduced by {abs(area_change_pct):.1f}%."
            cursor.execute("""
                INSERT INTO alerts (wb_id, area_change_pct, severity, alert_message, status)
                VALUES (?, ?, 'CRITICAL', ?, 'ACTIVE')
            """, (raw_id, area_change_pct, msg))
            alerts_triggered += 1

        # Seed sample interventions
        if wb_count <= 25:
            cursor.execute("""
                INSERT INTO interventions (wb_id, intervention_type, status, capacity_m3, installed_date, latitude, longitude)
                VALUES (?, 'Check Dam / Desilting Structure', 'COMPLETED', 15000.0, '2023-11-10', ?, ?)
            """, (raw_id, lat + 0.002, lon + 0.002))

        # Seed sample field photos
        if wb_count <= 35:
            cursor.execute("""
                INSERT INTO geo_coded_photos (wb_id, photo_url, latitude, longitude, caption)
                VALUES (?, 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600', ?, ?, 'Field verification photograph showing water shoreline status.')
            """, (raw_id, lat, lon))

        # Seed sample citizen feedback
        if wb_count <= 40:
            m_status = random.choice(["DRY", "OPTIMAL", "WATERLOGGED"])
            cursor.execute("""
                INSERT INTO citizen_feedback (wb_id, latitude, longitude, moisture_status, observation_note, reporter_name)
                VALUES (?, ?, ?, ?, 'Field check note from nearby farmer/citizen.', 'Local Farmer')
            """, (raw_id, lat + 0.001, lon + 0.001, m_status))

    conn.commit()
    conn.close()

    logger.info("=== Database Seeding Complete ===")
    logger.info(f"Total Water Bodies Seeded: {wb_count}")
    logger.info(f"Total Temporal Observations: {obs_count}")
    logger.info(f"Active Critical Alerts Triggered: {alerts_triggered}")

def main():
    try:
        seed_database()
        logger.info("SUCCESS: Database initialized and seeded successfully.")
    except Exception as e:
        logger.error(f"Database seeding failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
