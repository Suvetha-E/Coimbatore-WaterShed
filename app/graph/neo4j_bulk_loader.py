"""
app/graph/neo4j_bulk_loader.py
------------------------------
High-Performance Bulk Ingestion Engine for Neo4j.

Uses Cypher's `UNWIND $features AS feat` to batch-load Watershed and WaterBody entities
from district GeoJSON datasets in single high-performance transactions.
Binds dedicated `ParameterNode` entities (`[:HAS_PARAMETERS]`) to support click-to-evaluate
telemetry and LLM root-cause analysis.
"""

import os
import json
import time
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.config import settings
from app.graph.neo4j_driver import get_neo4j_driver, check_neo4j_health

logger = logging.getLogger("app.graph.neo4j_bulk_loader")

WATERSHEDS_GEOJSON_PATH = Path(settings.DATABASE_PATH).parent / "processed" / "coimbatore_watersheds.geojson"
WATER_BODIES_GEOJSON_PATH = Path(settings.DATABASE_PATH).parent / "processed" / "coimbatore_water_bodies.geojson"

CYPHER_BULK_LOAD_WATERSHEDS = """
UNWIND $features AS feat
MERGE (ws:Watershed {id: feat.properties.watershed_id})
SET ws.name = feat.properties.name,
    ws.district = feat.properties.district,
    ws.river_basin = feat.properties.river_basin,
    ws.area_sqkm = toFloat(feat.properties.area_sqkm),
    ws.updated_at = timestamp()
MERGE (p:ParameterNode {id: 'PARAM_WS_' + feat.properties.watershed_id})
SET p.entity_type = 'Watershed',
    p.target_id = feat.properties.watershed_id,
    p.area_sqkm = toFloat(feat.properties.area_sqkm),
    p.river_basin = feat.properties.river_basin,
    p.updated_at = timestamp()
MERGE (ws)-[:HAS_PARAMETERS]->(p)
"""

CYPHER_BULK_LOAD_WATER_BODIES = """
UNWIND $features AS feat
MERGE (wb:WaterBody {id: toString(feat.properties.wb_id)})
SET wb.name = feat.properties.name,
    wb.category = feat.properties.category,
    wb.wetcode = toString(feat.properties.wetcode),
    wb.baseline_area_ha = toFloat(feat.properties.baseline_area_ha),
    wb.current_area_ha = toFloat(feat.properties.current_area_ha),
    wb.area_change_pct = toFloat(feat.properties.area_change_pct),
    wb.status = COALESCE(feat.properties.status, 'STABLE'),
    wb.latitude = toFloat(feat.properties.lat),
    wb.longitude = toFloat(feat.properties.long),
    wb.turbidity_level = COALESCE(feat.properties.turbidity, 'Low'),
    wb.updated_at = timestamp()
WITH feat, wb
MERGE (ws:Watershed {id: COALESCE(feat.properties.watershed_id, 'WS_NOYYAL_01')})
MERGE (ws)-[:CONTAINS]->(wb)
WITH feat, wb
MERGE (p:ParameterNode {id: 'PARAM_WB_' + toString(feat.properties.wb_id)})
SET p.entity_type = 'WaterBody',
    p.target_id = toString(feat.properties.wb_id),
    p.name = feat.properties.name,
    p.baseline_area_ha = toFloat(feat.properties.baseline_area_ha),
    p.current_area_ha = toFloat(feat.properties.current_area_ha),
    p.area_change_pct = toFloat(feat.properties.area_change_pct),
    p.turbidity_level = COALESCE(feat.properties.turbidity, 'Low'),
    p.cloud_cover_pct = 0.5,
    p.updated_at = timestamp()
MERGE (wb)-[:HAS_PARAMETERS]->(p)
"""

def read_geojson_features(filepath: Path) -> List[Dict[str, Any]]:
    """Reads GeoJSON file and extracts features array."""
    if not filepath.exists():
        logger.warning(f"GeoJSON file not found at path: {filepath}")
        return []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("features", [])
    except Exception as e:
        logger.error(f"Failed to parse GeoJSON at {filepath}: {e}")
        return []

def bulk_load_watersheds_from_geojson(geojson_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Step 1: Batch-loads Watershed features and binds ParameterNodes using Cypher UNWIND.
    """
    path = geojson_path or WATERSHEDS_GEOJSON_PATH
    features = read_geojson_features(path)
    if not features:
        return {"status": "EMPTY", "count": 0, "message": "No watershed features found."}

    driver = get_neo4j_driver()
    if driver is None:
        return {
            "status": "FALLBACK",
            "count": len(features),
            "message": "Neo4j offline. Bulk watershed ingestion bypassed gracefully."
        }

    start_time = time.time()
    try:
        with driver.session() as session:
            result = session.run(CYPHER_BULK_LOAD_WATERSHEDS, features=features)
            summary = result.consume()
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            
            logger.info(
                f"Successfully bulk-loaded {len(features)} Watershed nodes and bound ParameterNodes "
                f"in {elapsed_ms}ms (Nodes Created: {summary.counters.nodes_created}, Relationships Created: {summary.counters.relationships_created})."
            )

            return {
                "status": "SUCCESS",
                "count": len(features),
                "nodes_created": summary.counters.nodes_created,
                "relationships_created": summary.counters.relationships_created,
                "elapsed_ms": elapsed_ms,
                "query": "CYPHER_BULK_LOAD_WATERSHEDS"
            }
    except Exception as e:
        logger.error(f"Error during Cypher UNWIND watershed bulk load: {e}")
        return {"status": "ERROR", "error": str(e)}

import sqlite3

def get_sqlite_water_bodies_map() -> Dict[str, Dict[str, Any]]:
    """Helper to retrieve true water body names, categories, and watershed_ids from SQLite database."""
    db_path = settings.DATABASE_PATH
    if not Path(db_path).exists():
        return {}
    try:
        conn = sqlite3.connect(db_path, timeout=5.0)
        cursor = conn.cursor()
        cursor.execute("SELECT wb_id, name, category, wetcode, baseline_area_ha, current_area_ha, area_change_pct, status, watershed_id FROM water_bodies")
        rows = cursor.fetchall()
        conn.close()
        return {
            str(row[0]): {
                "name": row[1],
                "category": row[2],
                "wetcode": row[3],
                "baseline_area_ha": row[4],
                "current_area_ha": row[5],
                "area_change_pct": row[6],
                "status": row[7],
                "watershed_id": row[8]
            }
            for row in rows if row[0]
        }
    except Exception as e:
        logger.debug(f"Could not load SQLite water body map: {e}")
        return {}

def bulk_load_water_bodies_from_geojson(geojson_path: Optional[Path] = None, batch_size: int = 500) -> Dict[str, Any]:
    """
    Step 2: Batch-loads WaterBody features, connects [:CONTAINS] to Watersheds across all 5 official basins,
    and binds [:HAS_PARAMETERS] ParameterNodes using Cypher UNWIND.
    Preprocesses feature properties mapping true names and watershed_ids from SQLite and GeoJSON attributes.
    """
    path = geojson_path or WATER_BODIES_GEOJSON_PATH
    features = read_geojson_features(path)
    if not features:
        return {"status": "EMPTY", "count": 0, "message": "No water body features found."}

    # Fetch true water body names and watershed_ids from SQLite database
    db_map = get_sqlite_water_bodies_map()

    # Preprocess features to ensure true names and multi-watershed IDs are assigned
    for feat in features:
        props = feat.setdefault("properties", {})
        wb_id = str(props.get("wb_id") or props.get("id") or "")
        props["wb_id"] = wb_id
        
        db_info = db_map.get(wb_id, {})
        db_name = db_info.get("name")
        
        raw_name = db_name or props.get("name") or props.get("wetname")
        category = str(db_info.get("category") or props.get("category") or props.get("level_iii") or "Water Body").strip()
        props["category"] = category

        wetcode = str(db_info.get("wetcode") or props.get("wetcode") or props.get("wet_code") or props.get("id") or wb_id).strip()
        props["wetcode"] = wetcode
        
        ws_id = str(db_info.get("watershed_id") or props.get("watershed_id") or "WS_NOYYAL_01").strip()
        props["watershed_id"] = ws_id

        if raw_name and str(raw_name).strip() not in ["", "Unnamed Water Body", "None", "null"]:
            props["name"] = str(raw_name).strip()
        elif category and wb_id:
            props["name"] = f"{category} {wb_id}".strip()
        elif wetcode:
            props["name"] = f"Wetcode {wetcode}".strip()
        else:
            props["name"] = f"Water Body {wb_id}".strip()

    driver = get_neo4j_driver()
    if driver is None:
        return {
            "status": "FALLBACK",
            "count": len(features),
            "message": "Neo4j offline. Bulk water body ingestion bypassed gracefully."
        }

    start_time = time.time()
    total_nodes_created = 0
    total_relationships_created = 0

    try:
        with driver.session() as session:
            # Process in batches for maximum transaction throughput
            for i in range(0, len(features), batch_size):
                chunk = features[i:i + batch_size]
                result = session.run(CYPHER_BULK_LOAD_WATER_BODIES, features=chunk)
                summary = result.consume()
                total_nodes_created += summary.counters.nodes_created
                total_relationships_created += summary.counters.relationships_created

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(
            f"Successfully bulk-loaded {len(features)} WaterBody nodes, Watershed links, and ParameterNodes "
            f"in {elapsed_ms}ms (Nodes Created: {total_nodes_created}, Relationships Created: {total_relationships_created})."
        )

        return {
            "status": "SUCCESS",
            "count": len(features),
            "nodes_created": total_nodes_created,
            "relationships_created": total_relationships_created,
            "elapsed_ms": elapsed_ms,
            "batch_size": batch_size
        }
    except Exception as e:
        logger.error(f"Error during Cypher UNWIND water body bulk load: {e}")
        return {"status": "ERROR", "error": str(e)}

CYPHER_BULK_LOAD_OFFICERS = """
UNWIND $officers AS off
MERGE (o:Officer {email: off.email})
SET o.name = off.name,
    o.username = off.username,
    o.role = off.role,
    o.updated_at = timestamp()
WITH off, o
UNWIND off.tasks AS t
MATCH (wb:WaterBody {id: toString(t.wb_id)})
MERGE (o)-[r:ASSIGNED_TO]->(wb)
SET r.task_id = t.task_id,
    r.priority = t.priority,
    r.status = t.status,
    r.assigned_at = toString(t.assigned_at)
"""

CYPHER_BULK_LOAD_EVIDENCE = """
UNWIND $evidence AS ev
MERGE (e:EvidenceLog {id: toString(ev.id)})
SET e.type = ev.type,
    e.wb_id = toString(ev.wb_id),
    e.reporter_name = ev.reporter_name,
    e.note = ev.note,
    e.photo_url = ev.photo_url,
    e.moisture_status = ev.moisture_status,
    e.created_at = toString(ev.created_at)
WITH ev, e
MATCH (wb:WaterBody {id: toString(ev.wb_id)})
MERGE (wb)-[r:HAS_EVIDENCE]->(e)
"""

def bulk_load_officers_and_evidence_from_db() -> Dict[str, Any]:
    """
    Step 3: Dynamically loads Officer assignments and EvidenceLogs (citizen feedback & photos)
    from SQLite database and binds [:ASSIGNED_TO] and [:HAS_EVIDENCE] in Neo4j.
    """
    driver = get_neo4j_driver()
    if driver is None:
        return {"status": "FALLBACK", "message": "Neo4j offline."}

    db_path = settings.DATABASE_PATH
    if not Path(db_path).exists():
        return {"status": "EMPTY", "message": "SQLite database not found."}

    try:
        conn = sqlite3.connect(db_path, timeout=5.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Fetch officers & tasks
        cursor.execute("SELECT * FROM users WHERE LOWER(role) = 'officer'")
        officers_rows = [dict(r) for r in cursor.fetchall()]
        
        officers_data = []
        for off in officers_rows:
            email = off["email"]
            name = off["name"]
            cursor.execute("SELECT task_id, wb_id, priority, status, assigned_at FROM officer_tasks WHERE LOWER(officer_name) LIKE LOWER(?) OR LOWER(officer_name) LIKE LOWER(?)", (f"%{name}%", f"%{off['username']}%"))
            tasks = [dict(t) for t in cursor.fetchall()]
            if tasks:
                officers_data.append({
                    "email": email,
                    "name": name,
                    "username": off["username"],
                    "role": off["role"],
                    "tasks": tasks
                })

        # Fetch citizen feedback & photos
        cursor.execute("SELECT id, wb_id, reporter_name, observation_note as note, photo_url, moisture_status, created_at FROM citizen_feedback")
        feedback_evidence = [
            {
                "id": f"FB_{r['id']}",
                "wb_id": r["wb_id"],
                "type": "CITIZEN_FEEDBACK",
                "reporter_name": r["reporter_name"] or "Citizen",
                "note": r["note"] or "Field Observation",
                "photo_url": r["photo_url"] or "",
                "moisture_status": r["moisture_status"] or "DRY",
                "created_at": str(r["created_at"])
            }
            for r in cursor.fetchall()
        ]

        cursor.execute("SELECT id, wb_id, caption as note, photo_url, captured_at as created_at FROM geo_coded_photos")
        photo_evidence = [
            {
                "id": f"PHOTO_{r['id']}",
                "wb_id": r["wb_id"],
                "type": "GEO_PHOTO",
                "reporter_name": "Field Officer",
                "note": r["note"] or "Inspection Photo",
                "photo_url": r["photo_url"] or "",
                "moisture_status": "FIELD_PHOTO",
                "created_at": str(r["created_at"])
            }
            for r in cursor.fetchall()
        ]

        conn.close()

        all_evidence = feedback_evidence + photo_evidence
        
        start_time = time.time()
        officer_nodes = 0
        evidence_nodes = 0

        with driver.session() as session:
            if officers_data:
                res1 = session.run(CYPHER_BULK_LOAD_OFFICERS, officers=officers_data)
                sum1 = res1.consume()
                officer_nodes = sum1.counters.nodes_created
            if all_evidence:
                res2 = session.run(CYPHER_BULK_LOAD_EVIDENCE, evidence=all_evidence)
                sum2 = res2.consume()
                evidence_nodes = sum2.counters.nodes_created

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(f"Loaded {len(officers_data)} officers and {len(all_evidence)} evidence logs into Neo4j in {elapsed_ms}ms.")

        return {
            "status": "SUCCESS",
            "officers_processed": len(officers_data),
            "evidence_logs_processed": len(all_evidence),
            "elapsed_ms": elapsed_ms
        }
    except Exception as e:
        logger.error(f"Error binding officers and evidence to Neo4j: {e}")
        return {"status": "ERROR", "error": str(e)}

def run_neo4j_bulk_ingestion() -> Dict[str, Any]:
    """
    Main entry point function orchestrating full Neo4j dataset ingestion.
    """
    health = check_neo4j_health()
    if not health.get("connected", False):
        return {
            "status": "FALLBACK",
            "message": "Neo4j database instance is offline. Using SQLite spatial fallback.",
            "health": health
        }

    ws_res = bulk_load_watersheds_from_geojson()
    wb_res = bulk_load_water_bodies_from_geojson()
    off_res = bulk_load_officers_and_evidence_from_db()

    return {
        "status": "COMPLETED",
        "neo4j_health": health,
        "watersheds_summary": ws_res,
        "water_bodies_summary": wb_res,
        "officers_and_evidence_summary": off_res,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

