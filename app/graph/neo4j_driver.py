"""
app/graph/neo4j_driver.py
-------------------------
Optional Neo4j Relationship Engine.
Models spatial and hydrological entity relationships:
  (Watershed)-[:CONTAINS]->(WaterBody)
  (WaterBody)-[:CONNECTED_TO]->(DrainageLine)
  (WaterBody)-[:NEAR]->(Intervention)
  (WaterBody)-[:HAS_PHOTO]->(GeoCodedPhoto)

Includes graceful fallback when Neo4j instance is not running locally.
"""

import os
import logging
from typing import Dict, Any, List

logger = logging.getLogger("app.graph.neo4j_driver")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "neo4j123")

_driver = None

def get_neo4j_driver():
    """Initializes Neo4j driver lazily if neo4j package is installed and server is reachable."""
    global _driver
    if _driver is not None:
        try:
            _driver.verify_connectivity()
            return _driver
        except Exception:
            _driver = None

    try:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        driver.verify_connectivity()
        logger.info("Connected to Neo4j Relationship Graph database successfully.")
        _driver = driver
        return _driver
    except Exception as e:
        logger.debug(f"Neo4j instance offline or driver unavailable ({e}). Using SQLite spatial relationship fallback.")
        return None

def check_neo4j_health() -> Dict[str, Any]:
    """
    Verifies Neo4j connection status and returns connectivity metadata or graceful fallback status.
    """
    driver = get_neo4j_driver()
    if driver is not None:
        try:
            driver.verify_connectivity()
            return {
                "status": "ONLINE",
                "connected": True,
                "uri": NEO4J_URI,
                "database_engine": "Neo4j Desktop / Graph Database",
                "message": "Neo4j Relationship Graph database connected successfully and active.",
                "fallback_active": False
            }
        except Exception as e:
            return {
                "status": "FALLBACK",
                "connected": False,
                "uri": NEO4J_URI,
                "database_engine": "SQLite Spatial Fallback Engine",
                "error": str(e),
                "message": "Neo4j connection error. Using SQLite spatial relationship fallback.",
                "fallback_active": True
            }

    return {
        "status": "FALLBACK",
        "connected": False,
        "uri": NEO4J_URI,
        "database_engine": "SQLite Spatial Fallback Engine",
        "message": "Neo4j graph service offline or driver unavailable. Using SQLite spatial relationship fallback.",
        "fallback_active": True
    }

def get_sqlite_fallback_relationships(wb_id: str) -> Dict[str, Any]:
    """
    Dynamically constructs graph nodes and relationships from SQLite database
    when Neo4j is offline. Eliminates all hardcoded static placeholders.
    """
    from app.config import settings
    import sqlite3
    db_path = settings.DATABASE_PATH
    if not os.path.exists(db_path):
        return {"status": "FALLBACK", "message": "SQLite database not found.", "nodes": [], "relationships": []}

    try:
        conn = sqlite3.connect(db_path, timeout=5.0)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM water_bodies WHERE wb_id = ?", (wb_id,))
        wb = cursor.fetchone()
        if not wb:
            conn.close()
            return {"status": "EMPTY", "nodes": [], "relationships": []}

        wb_dict = dict(wb)
        ws_id = wb_dict.get("watershed_id", "WS_NOYYAL_01")
        wb_name = wb_dict.get("name") or f"Water Body {wb_id}"

        cursor.execute("SELECT * FROM watersheds WHERE watershed_id = ?", (ws_id,))
        ws = cursor.fetchone()
        ws_name = dict(ws).get("name", "Noyyal River Basin") if ws else "Noyyal Sub-Watershed"

        cursor.execute("SELECT officer_name, priority, status FROM officer_tasks WHERE wb_id = ? ORDER BY assigned_at DESC LIMIT 1", (wb_id,))
        task = cursor.fetchone()

        cursor.execute("SELECT id, reporter_name, observation_note, moisture_status FROM citizen_feedback WHERE wb_id = ? ORDER BY created_at DESC LIMIT 3", (wb_id,))
        feedbacks = [dict(f) for f in cursor.fetchall()]

        cursor.execute("SELECT * FROM interventions WHERE wb_id = ?", (wb_id,))
        interventions = [dict(i) for i in cursor.fetchall()]

        conn.close()

        nodes = [
            {"id": wb_id, "label": "WaterBody", "properties": {"id": wb_id, "name": wb_name, "category": wb_dict.get("category", "Water Body")}},
            {"id": ws_id, "label": "Watershed", "properties": {"id": ws_id, "name": ws_name}},
            {"id": f"PARAM_WB_{wb_id}", "label": "ParameterNode", "properties": {"baseline_area_ha": wb_dict.get("baseline_area_ha"), "current_area_ha": wb_dict.get("current_area_ha"), "area_change_pct": wb_dict.get("area_change_pct")}}
        ]
        relationships = [
            {"source": ws_id, "target": wb_id, "type": "CONTAINS"},
            {"source": wb_id, "target": f"PARAM_WB_{wb_id}", "type": "HAS_PARAMETERS"}
        ]

        if task:
            task_dict = dict(task)
            off_name = task_dict["officer_name"]
            nodes.append({"id": off_name, "label": "Officer", "properties": {"name": off_name, "priority": task_dict["priority"], "status": task_dict["status"]}})
            relationships.append({"source": off_name, "target": wb_id, "type": "ASSIGNED_TO"})

        for fb in feedbacks:
            fb_id = f"FB_{fb['id']}"
            nodes.append({"id": fb_id, "label": "EvidenceLog", "properties": {"reporter": fb["reporter_name"], "note": fb["observation_note"], "moisture": fb["moisture_status"]}})
            relationships.append({"source": wb_id, "target": fb_id, "type": "HAS_EVIDENCE"})

        for it in interventions:
            it_id = f"INT_{it.get('id', '001')}"
            nodes.append({"id": it_id, "label": "Intervention", "properties": {"type": it.get("intervention_type", "Check Dam")}})
            relationships.append({"source": wb_id, "target": it_id, "type": "NEAR"})

        return {
            "status": "FALLBACK",
            "message": f"Neo4j offline. Spatial graph for {wb_name} generated dynamically from SQLite database records.",
            "water_body_id": wb_id,
            "nodes": nodes,
            "relationships": relationships
        }
    except Exception as e:
        logger.error(f"Error in dynamic SQLite fallback relationships for {wb_id}: {e}")
        return {"status": "ERROR", "message": str(e)}

def get_water_body_relationships(wb_id: str) -> Dict[str, Any]:
    """
    Queries Neo4j for multi-hop entity relationships connected to target water body:
      (Watershed)-[:CONTAINS]->(WaterBody)
      (WaterBody)-[:HAS_PARAMETERS]->(ParameterNode)
      (Officer)-[:ASSIGNED_TO]->(WaterBody)
      (WaterBody)-[:HAS_EVIDENCE]->(EvidenceLog)
      (WaterBody)-[:CONNECTED_TO]->(DrainageLine)
      (WaterBody)-[:NEAR]->(Intervention)

    Returns structured graph representation or dynamic SQLite fallback dictionary.
    """
    driver = get_neo4j_driver()
    if driver is None:
        return get_sqlite_fallback_relationships(wb_id)

    query = """
    MATCH (wb:WaterBody {id: $wb_id})
    OPTIONAL MATCH (ws:Watershed)-[r1:CONTAINS]->(wb)
    OPTIONAL MATCH (wb)-[r2:HAS_PARAMETERS]->(param:ParameterNode)
    OPTIONAL MATCH (off:Officer)-[r3:ASSIGNED_TO]->(wb)
    OPTIONAL MATCH (wb)-[r4:HAS_EVIDENCE]->(ev:EvidenceLog)
    OPTIONAL MATCH (wb)-[r5:CONNECTED_TO]->(d:DrainageLine)
    OPTIONAL MATCH (wb)-[r6:NEAR]->(i:Intervention)
    RETURN wb, ws, param, off, ev, d, i
    """

    try:
        with driver.session() as session:
            result = session.run(query, wb_id=str(wb_id))
            records = result.data()
            if not records:
                return {"status": "EMPTY", "nodes": [], "relationships": []}
            
            nodes_dict = {}
            relationships_list = []

            for row in records:
                wb_node = row.get("wb")
                ws_node = row.get("ws")
                param_node = row.get("param")
                off_node = row.get("off")
                ev_node = row.get("ev")
                d_node = row.get("d")
                i_node = row.get("i")

                if wb_node:
                    wb_key = f"WB_{wb_node['id']}"
                    nodes_dict[wb_key] = {"id": wb_node["id"], "label": "WaterBody", "properties": dict(wb_node)}
                
                if ws_node:
                    ws_key = f"WS_{ws_node['id']}"
                    nodes_dict[ws_key] = {"id": ws_node["id"], "label": "Watershed", "properties": dict(ws_node)}
                    relationships_list.append({"source": ws_node["id"], "target": str(wb_id), "type": "CONTAINS"})
                
                if param_node:
                    param_key = f"PARAM_{param_node['id']}"
                    nodes_dict[param_key] = {"id": param_node["id"], "label": "ParameterNode", "properties": dict(param_node)}
                    relationships_list.append({"source": str(wb_id), "target": param_node["id"], "type": "HAS_PARAMETERS"})

                if off_node:
                    off_key = f"OFF_{off_node['email']}"
                    nodes_dict[off_key] = {"id": off_node["email"], "label": "Officer", "properties": dict(off_node)}
                    relationships_list.append({"source": off_node["email"], "target": str(wb_id), "type": "ASSIGNED_TO"})

                if ev_node:
                    ev_key = f"EV_{ev_node['id']}"
                    nodes_dict[ev_key] = {"id": ev_node["id"], "label": "EvidenceLog", "properties": dict(ev_node)}
                    relationships_list.append({"source": str(wb_id), "target": ev_node["id"], "type": "HAS_EVIDENCE"})

                if d_node:
                    d_key = f"DRN_{d_node['id']}"
                    nodes_dict[d_key] = {"id": d_node["id"], "label": "DrainageLine", "properties": dict(d_node)}
                    relationships_list.append({"source": str(wb_id), "target": d_node["id"], "type": "CONNECTED_TO"})

                if i_node:
                    i_key = f"INT_{i_node['id']}"
                    nodes_dict[i_key] = {"id": i_node["id"], "label": "Intervention", "properties": dict(i_node)}
                    relationships_list.append({"source": str(wb_id), "target": i_node["id"], "type": "NEAR"})

            # Deduplicate relationships
            dedup_rels = []
            seen_rels = set()
            for rel in relationships_list:
                rel_tuple = (rel["source"], rel["target"], rel["type"])
                if rel_tuple not in seen_rels:
                    seen_rels.add(rel_tuple)
                    dedup_rels.append(rel)

            return {
                "status": "ACTIVE",
                "water_body_id": str(wb_id),
                "nodes": list(nodes_dict.values()),
                "relationships": dedup_rels
            }
    except Exception as e:
        logger.error(f"Error querying Neo4j graph for {wb_id}: {e}")
        return {"status": "ERROR", "message": str(e)}

def sync_officer_task_to_neo4j(
    officer_name_or_email: str,
    wb_id: str,
    task_id: Any,
    priority: str = "HIGH",
    status: str = "PENDING",
    task_description: str = ""
) -> bool:
    """Real-time dual-store synchronization creating/linking (:TaskNode), (:Officer)-[:ASSIGNED_TO]->(:TaskNode)-[:ASSOCIATED_WITH]->(:WaterBody) in Neo4j."""
    driver = get_neo4j_driver()
    if driver is None:
        return False
    query = """
    MERGE (t:TaskNode {id: toString($task_id)})
    SET t.wb_id = toString($wb_id),
        t.officer_name = $name,
        t.priority = $priority,
        t.status = $status,
        t.task_description = $task_description,
        t.assigned_at = timestamp()
    WITH t
    MERGE (o:Officer {email: $email})
    SET o.name = $name, o.role = 'FIELD_OFFICER', o.updated_at = timestamp()
    WITH t, o
    MERGE (wb:WaterBody {id: toString($wb_id)})
    WITH t, o, wb
    MERGE (o)-[r1:ASSIGNED_TO]->(t)
    SET r1.task_id = toString($task_id), r1.priority = $priority, r1.status = $status
    MERGE (t)-[r2:ASSOCIATED_WITH]->(wb)
    MERGE (o)-[r3:ASSIGNED_TO]->(wb)
    SET r3.task_id = toString($task_id), r3.priority = $priority, r3.status = $status
    """
    try:
        email = officer_name_or_email if "@" in officer_name_or_email else f"{officer_name_or_email.lower().replace(' ', '.')}@watershed.tn.gov.in"
        with driver.session() as session:
            session.run(
                query,
                email=email,
                name=officer_name_or_email,
                wb_id=str(wb_id),
                task_id=str(task_id),
                priority=priority,
                status=status,
                task_description=task_description
            )
            return True
    except Exception as e:
        logger.error(f"Error syncing officer task to Neo4j: {e}")
        return False

def sync_evidence_log_to_neo4j(evidence_id: str, wb_id: str, ev_type: str, reporter_name: str, note: str, photo_url: str = "", moisture_status: str = "FIELD_PHOTO") -> bool:
    """Real-time dual-store synchronization creating/linking (:WaterBody)-[:HAS_EVIDENCE]->(:EvidenceLog) in Neo4j."""
    driver = get_neo4j_driver()
    if driver is None:
        return False
    query = """
    MERGE (e:EvidenceLog {id: toString($ev_id)})
    SET e.type = $ev_type,
        e.wb_id = toString($wb_id),
        e.reporter_name = $reporter_name,
        e.note = $note,
        e.photo_url = $photo_url,
        e.moisture_status = $moisture_status,
        e.created_at = timestamp()
    WITH e
    MERGE (wb:WaterBody {id: toString($wb_id)})
    MERGE (wb)-[r:HAS_EVIDENCE]->(e)
    """
    try:
        with driver.session() as session:
            session.run(query, ev_id=str(evidence_id), wb_id=str(wb_id), ev_type=ev_type, reporter_name=reporter_name, note=note, photo_url=photo_url, moisture_status=moisture_status)
            return True
    except Exception as e:
        logger.error(f"Error syncing evidence log to Neo4j: {e}")
        return False


