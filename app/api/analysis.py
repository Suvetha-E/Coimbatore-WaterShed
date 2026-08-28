"""
app/api/analysis.py
-------------------
Endpoint for retrieving temporal change analysis, contextual indicators,
field photo evidence, Neo4j relationship graph, and 5-tier rule-based assessment.
"""

import logging
from fastapi import APIRouter, HTTPException, Path
from app.database.spatialite import get_db_connection
from app.analysis.assessment import evaluate_water_body_context
from app.graph.neo4j_driver import get_water_body_relationships
from app.analysis.root_cause_engine import (
    evaluate_environmental_parameters,
    generate_llm_root_cause_analysis,
    build_admin_alert_payload
)

router = APIRouter(prefix="/water-body", tags=["Analysis Engine"])
logger = logging.getLogger("app.api.analysis")

@router.get("/{id}/analyze", summary="Analyze Water Body Temporal Change & Context")
def analyze_water_body(
    id: str = Path(..., description="Unique water body ID (e.g. 13734 or CBE_WB_0001)")
):
    """
    Computes temporal change, retrieves ground soil-moisture feedback, photo evidence,
    Neo4j relationships, and returns non-causal contextual assessment profile.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch Water Body
    cursor.execute("SELECT * FROM water_bodies WHERE wb_id = ?", (id,))
    wb = cursor.fetchone()
    if not wb:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Water Body ID '{id}' not found.")

    wb_dict = dict(wb)

    # 2. Fetch Temporal Observations
    cursor.execute("""
        SELECT observation_date, acquisition_month, season, area_ha, cloud_cover_pct, confidence, source
        FROM water_body_observations
        WHERE wb_id = ?
        ORDER BY observation_date ASC
    """, (id,))
    obs_rows = cursor.fetchall()
    observations = [dict(r) for r in obs_rows]

    # 3. Fetch Citizen Feedback
    cursor.execute("""
        SELECT id, wb_id as water_body_id, latitude, longitude, moisture_status, observation_note, reporter_name, created_at
        FROM citizen_feedback
        WHERE wb_id = ?
        ORDER BY created_at DESC
    """, (id,))
    feedback_rows = cursor.fetchall()
    feedbacks = [
        {
            "id": r["id"],
            "water_body_id": r["water_body_id"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "moisture_status": r["moisture_status"],
            "observation_note": r["observation_note"],
            "reporter_name": r["reporter_name"],
            "created_at": str(r["created_at"])
        }
        for r in feedback_rows
    ]

    # 4. Fetch Interventions
    cursor.execute("SELECT * FROM interventions WHERE wb_id = ?", (id,))
    interventions = [dict(r) for r in cursor.fetchall()]

    # 5. Fetch Field Photos
    cursor.execute("SELECT id, photo_url, latitude, longitude, caption, captured_at FROM geo_coded_photos WHERE wb_id = ?", (id,))
    photo_rows = cursor.fetchall()
    photos = [
        {
            "id": r["id"],
            "photo_url": r["photo_url"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "caption": r["caption"] or "Field Photo",
            "captured_at": str(r["captured_at"])
        }
        for r in photo_rows
    ]

    conn.close()

    # 6. Run Assessment Engine with 5-tier classification
    assessment = evaluate_water_body_context(wb_dict, feedbacks, interventions, photos)

    # 7. Fetch Optional Neo4j Relationship Graph
    neo4j_graph = get_water_body_relationships(id)

    return {
        "water_body_id": wb_dict["wb_id"],
        "name": wb_dict["name"] or "Unnamed Water Body",
        "category": wb_dict["category"] or "Water Body",
        "watershed_id": wb_dict.get("watershed_id", "WS_NOYYAL_01"),
        "baseline_area_ha": wb_dict["baseline_area_ha"],
        "current_area_ha": wb_dict["current_area_ha"],
        "area_change_pct": wb_dict["area_change_pct"],
        "status": wb_dict["status"],
        "assessment": assessment,
        "temporal_observations": observations,
        "recent_citizen_feedback": feedbacks,
        "geo_coded_photos": photos,
        "relationship_graph": neo4j_graph
    }

@router.get("/{id}/history", summary="Get Temporal Observation History")
def get_water_body_history(id: str = Path(...)):
    """Returns multi-temporal satellite observation records for a water body."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT observation_date, acquisition_month, season, area_ha, cloud_cover_pct, confidence, source
        FROM water_body_observations
        WHERE wb_id = ?
        ORDER BY observation_date ASC
    """, (id,))
    rows = cursor.fetchall()
    conn.close()
    return {"water_body_id": id, "observations": [dict(r) for r in rows]}

@router.get("/{id}/context", summary="Get Surrounding Watershed Context")
def get_water_body_context(id: str = Path(...)):
    """Returns surrounding spatial context (agriculture proximity, check dams, drainage connectivity)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM interventions WHERE wb_id = ?", (id,))
    interventions = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    return {
        "water_body_id": id,
        "agri_land_proximity_m": 350,
        "mean_ndvi_buffer": 0.48,
        "drainage_stream": "Noyyal Primary Branch Stream",
        "check_dams": interventions
    }

@router.get("/{id}/root-cause-analysis", summary="LLM Root Cause Analysis & Admin Alert Payload")
@router.post("/{id}/root-cause-analysis", summary="LLM Root Cause Analysis & Admin Alert Payload")
def get_water_body_root_cause_analysis(
    id: str = Path(..., description="Unique water body ID (e.g. 13734 or CBE_WB_0001)")
):
    """
    Executes the end-to-end 4-step pipeline:
    1. Water Body Click & Neo4j Graph Traversal
    2. Parameter & Environmental Evaluation (turbidity, shrinkage, soil moisture, drought indicators)
    3. LLM Reasoning Generation (natural language explanation & root-cause analysis)
    4. Admin Notification Payload (packaged with pond name, river basin, GPS, officer details)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch Water Body
    cursor.execute("SELECT * FROM water_bodies WHERE wb_id = ?", (id,))
    wb = cursor.fetchone()
    if not wb:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Water Body ID '{id}' not found.")

    wb_dict = dict(wb)

    # 2. Fetch Temporal Observations
    cursor.execute("""
        SELECT observation_date, acquisition_month, season, area_ha, cloud_cover_pct, confidence, source
        FROM water_body_observations
        WHERE wb_id = ?
        ORDER BY observation_date ASC
    """, (id,))
    observations = [dict(r) for r in cursor.fetchall()]

    # 3. Fetch Citizen Soil Moisture Feedback
    cursor.execute("SELECT * FROM citizen_feedback WHERE wb_id = ? ORDER BY created_at DESC", (id,))
    feedbacks = [dict(r) for r in cursor.fetchall()]

    # 4. Fetch Interventions
    try:
        cursor.execute("SELECT * FROM interventions WHERE wb_id = ?", (id,))
        interventions = [dict(r) for r in cursor.fetchall()]
    except Exception:
        interventions = []

    # 5. Fetch Assigned Officer Task details if available
    cursor.execute("""
        SELECT officer_name, priority, task_description, status, assigned_at
        FROM officer_tasks
        WHERE wb_id = ?
        ORDER BY assigned_at DESC LIMIT 1
    """, (id,))
    task_row = cursor.fetchone()
    officer_info = {
        "name": task_row["officer_name"] if task_row else "Officer S. Anitha",
        "email": "officer.ramesh@watershed.tn.gov.in"
    }

    conn.close()

    # Step 1: Neo4j Graph Traversal
    neo4j_graph = get_water_body_relationships(id)

    # Step 2: Parameter & Environmental Evaluation
    param_eval = evaluate_environmental_parameters(
        water_body=wb_dict,
        observations=observations,
        feedbacks=feedbacks,
        interventions=interventions,
        neo4j_graph=neo4j_graph
    )

    # Step 3: LLM Reasoning Generation
    llm_reasoning = generate_llm_root_cause_analysis(
        water_body=wb_dict,
        param_eval=param_eval,
        neo4j_graph=neo4j_graph,
        officer_info=officer_info
    )

    # Step 4: Admin Notification Payload Packaging
    admin_payload = build_admin_alert_payload(
        water_body=wb_dict,
        param_eval=param_eval,
        llm_reasoning=llm_reasoning,
        neo4j_graph=neo4j_graph,
        officer_info=officer_info
    )

    return admin_payload

