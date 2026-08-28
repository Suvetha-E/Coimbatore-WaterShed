"""
tests/test_e2e_watershed_platform.py
--------------------------------------
End-to-End Automated Verification & Testing Suite for Coimbatore Watershed Intelligence Platform.

Tests:
1. Multi-Watershed Data Flow & API Endpoint Validation across all 5 official basins.
2. Real-Time Dynamic Officer Task Dispatch & Evidence Log Graph Binding.
3. Telemetry Parameter Integrity & Zero Orphaned Node Graph Traversal.
4. LLM Root-Cause Analysis Payload Integrity for Multi-Basin Water Bodies.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.graph.neo4j_driver import get_neo4j_driver

client = TestClient(app)

def get_admin_auth_header():
    res = client.post("/api/auth/login", json={"username": "admin_cbe", "password": "admin123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def get_citizen_auth_header():
    # Sync citizen user and obtain token
    sync_res = client.post("/api/auth/sync-user", json={
        "firebase_uid": "test_citizen_uid_99",
        "email": "farmer_citizen@watershed.tn.gov.in",
        "name": "Kavitha Farmer",
        "role": "CITIZEN"
    })
    assert sync_res.status_code == 200
    res = client.post("/api/auth/login", json={"username": "citizen_user", "password": "password123"})
    if res.status_code == 200:
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    return {}

# --- TEST 1: Multi-Watershed Data Flow across all 5 Basins ---
def test_multi_watershed_api_filtering():
    official_watersheds = [
        "WS_NOYYAL_01",
        "WS_BHAVANI_02",
        "WS_ALIYAR_03",
        "WS_AMARAVATHI_04",
        "WS_SIRUVANI_05"
    ]
    
    for ws_id in official_watersheds:
        res = client.get(f"/api/water-bodies?watershed_id={ws_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["type"] == "FeatureCollection"
        features = data["features"]
        assert len(features) > 0, f"No water bodies found for watershed {ws_id}"
        
        # Verify all returned features belong to requested watershed
        for feat in features[:5]:
            assert feat["properties"]["watershed_id"] == ws_id

# --- TEST 2: Neo4j Multi-Watershed Traversal Verification ---
def test_neo4j_multi_watershed_graph_traversal():
    driver = get_neo4j_driver()
    if driver is None:
        pytest.skip("Neo4j offline; skipping live GraphDatabase traversal test.")
        
    with driver.session() as session:
        query = """
        MATCH (ws:Watershed)-[:CONTAINS]->(wb:WaterBody)
        RETURN ws.id AS ws_id, ws.name AS ws_name, count(wb) AS wb_count
        """
        records = session.run(query).data()
        assert len(records) >= 5, "Expected all 5 watersheds in Neo4j graph"
        
        found_basins = {r["ws_id"]: r["wb_count"] for r in records}
        for ws_id in ["WS_NOYYAL_01", "WS_BHAVANI_02", "WS_ALIYAR_03", "WS_AMARAVATHI_04", "WS_SIRUVANI_05"]:
            assert ws_id in found_basins, f"Missing watershed {ws_id} in Neo4j"
            assert found_basins[ws_id] > 0, f"Watershed {ws_id} has 0 water bodies"

# --- TEST 3: Real-Time Dynamic Officer Task Dispatch & Neo4j Linkage ---
def test_realtime_officer_task_dispatch_and_neo4j_linkage():
    headers = get_admin_auth_header()
    payload = {
        "water_body_id": "6284",
        "officer_name": "Officer S. Anitha",
        "priority": "HIGH",
        "task_description": "End-to-End Automated Verification Task"
    }
    res = client.post("/api/admin/assign-task", json=payload, headers=headers)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "PENDING"
    task_id = res_data["task_id"]
    
    # Query Neo4j to confirm dynamic link (:Officer)-[:ASSIGNED_TO]->(:WaterBody)
    driver = get_neo4j_driver()
    if driver is not None:
        with driver.session() as session:
            query = """
            MATCH (o:Officer)-[r:ASSIGNED_TO]->(wb:WaterBody {id: '6284'})
            RETURN o.name AS off_name, o.email AS off_email, r.task_id AS task_id, r.priority AS priority
            """
            records = session.run(query).data()
            assert len(records) > 0, "Officer assignment edge missing in Neo4j"
            rec = records[-1]
            assert "Anitha" in rec["off_name"] or "officer" in rec["off_email"]
            assert str(rec["priority"]) == "HIGH"

# --- TEST 4: Real-Time Citizen Evidence Submission & Neo4j Linkage ---
def test_realtime_citizen_evidence_submission_and_neo4j_linkage():
    headers = get_citizen_auth_header()
    payload = {
        "water_body_id": "6284",
        "latitude": 10.9921,
        "longitude": 76.9631,
        "moisture_status": "DRY",
        "observation_note": "Ground verification indicates severe soil dryness at feeder inlet.",
        "photo_url": "https://storage.googleapis.com/watershed/reports/photo_6284_verify.jpg",
        "reporter_name": "Kavitha Farmer"
    }
    res = client.post("/api/citizen/feedback", json=payload, headers=headers if headers else None)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "SUCCESS"
    feedback_id = res_data["feedback_id"]

    # Query Neo4j to confirm dynamic link (:WaterBody)-[:HAS_EVIDENCE]->(:EvidenceLog)
    driver = get_neo4j_driver()
    if driver is not None:
        with driver.session() as session:
            query = """
            MATCH (wb:WaterBody {id: '6284'})-[:HAS_EVIDENCE]->(e:EvidenceLog {id: $ev_id})
            RETURN e.reporter_name AS reporter, e.moisture_status AS moisture, e.note AS note
            """
            rec = session.run(query, ev_id=f"FB_{feedback_id}").single()
            assert rec is not None, "EvidenceLog edge missing in Neo4j"
            assert rec["reporter"] == "Kavitha Farmer"
            assert rec["moisture"] == "DRY"

# --- TEST 5: Telemetry Parameter Node Integrity & Zero Orphaned Nodes ---
def test_telemetry_parameter_nodes_integrity_and_zero_orphans():
    driver = get_neo4j_driver()
    if driver is None:
        pytest.skip("Neo4j offline; skipping telemetry parameter integrity test.")

    with driver.session() as session:
        # Check ParameterNode total count
        param_count = session.run("MATCH (p:ParameterNode) RETURN count(p) as cnt").single()["cnt"]
        assert param_count >= 935, f"Expected 935+ ParameterNodes, got {param_count}"

        # Check zero orphaned WaterBody nodes (all must have Watershed parent and ParameterNode child)
        orphaned_wb = session.run("""
        MATCH (wb:WaterBody)
        WHERE NOT (wb)<-[:CONTAINS]-(:Watershed) OR NOT (wb)-[:HAS_PARAMETERS]->(:ParameterNode)
        RETURN count(wb) as cnt
        """).single()["cnt"]
        assert orphaned_wb == 0, f"Found {orphaned_wb} orphaned WaterBody nodes without Watershed or ParameterNode!"

# --- TEST 6: Root Cause Analysis Endpoint across Multi-Basin Water Bodies ---
def test_root_cause_analysis_api_for_multi_basin_water_bodies():
    sample_wb_ids = ["6283", "6284", "13734", "38295"]
    for wb_id in sample_wb_ids:
        res = client.get(f"/api/water-body/{wb_id}/root-cause-analysis")
        assert res.status_code == 200
        payload = res.json()
        assert payload["target_water_body"]["water_body_id"] == wb_id
        assert payload["spatial_watershed_context"]["graph_traversal_status"] in ["ACTIVE", "FALLBACK"]
        assert payload["assigned_district_officer"]["dispatch_status"] in ["ASSIGNED", "PENDING"]
        assert "primary_root_cause" in payload["llm_root_cause_analysis"]
        assert len(payload["actionable_recommendations"]) > 0

# --- TEST 7: Interactive Task Completion & Neo4j Graph Synchronization ---
def test_task_completion_and_neo4j_evidence_sync():
    # 1. Admin assigns task
    admin_headers = get_admin_auth_header()
    assign_payload = {
        "water_body_id": "38295",
        "officer_name": "Officer S. Anitha",
        "priority": "HIGH",
        "task_description": "Interactive workflow completion test"
    }
    assign_res = client.post("/api/admin/assign-task", json=assign_payload, headers=admin_headers)
    assert assign_res.status_code == 200
    task_id = assign_res.json()["task_id"]

    # 2. Officer completes task via interactive completion endpoint
    officer_headers = {"Authorization": f"Bearer {admin_headers['Authorization'].split()[-1]}"}
    complete_payload = {
        "verification_findings": "Interactive ground verification completed. Shoreline boundary verified.",
        "moisture_status": "OPTIMAL",
        "photo_url": "https://storage.googleapis.com/watershed/reports/photo_38295.jpg"
    }
    complete_res = client.post(f"/api/officer/submit-report/{task_id}", json=complete_payload, headers=officer_headers)
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "COMPLETED"

    # 3. Verify Neo4j graph evidence linkage
    driver = get_neo4j_driver()
    if driver is not None:
        with driver.session() as session:
            query = """
            MATCH (wb:WaterBody {id: '38295'})-[:HAS_EVIDENCE]->(e:EvidenceLog {id: $ev_id})
            RETURN e.moisture_status AS moisture, e.note AS note
            """
            rec = session.run(query, ev_id=f"TASK_{task_id}").single()
            assert rec is not None, "Neo4j EvidenceLog edge missing after task completion"
            assert rec["moisture"] == "OPTIMAL"

# --- TEST 8: Dual-Store Task Dispatch Write & SQL Table View Population ---
def test_task_dispatch_dual_store_write_and_sql_table_viewer():
    admin_headers = get_admin_auth_header()
    wb_target = "38295"
    officer_target = "Officer K. Ramesh"
    
    # 1. Dispatch Task via Admin API Endpoint
    dispatch_payload = {
        "water_body_id": wb_target,
        "officer_name": officer_target,
        "priority": "HIGH",
        "task_description": "Dual-store verification check for SQL viewer table population"
    }
    res = client.post("/api/admin/assign-task", json=dispatch_payload, headers=admin_headers)
    assert res.status_code == 200
    res_data = res.json()
    assert "task_id" in res_data
    task_id = res_data["task_id"]

    # 2. Verify SQL Table Viewer endpoint (/api/admin/sql/table-data?table_name=officer_tasks)
    table_res = client.get("/api/admin/sql/table-data?table_name=officer_tasks&limit=20", headers=admin_headers)
    assert table_res.status_code == 200
    table_data = table_res.json()
    assert table_data["status"] == "SUCCESS"
    assert table_data["table_name"] == "officer_tasks"
    assert "task_id" in table_data["columns"]
    assert "officer_name" in table_data["columns"]
    
    # Confirm newly created task exists in row results
    task_ids_in_table = [row["task_id"] for row in table_data["data"]]
    assert task_id in task_ids_in_table, f"Dispatched task #{task_id} missing from officer_tasks SQL viewer response"

    # 3. Verify Neo4j Graph node & edge linkage
    driver = get_neo4j_driver()
    if driver is not None:
        with driver.session() as session:
            query = """
            MATCH (o:Officer)-[r:ASSIGNED_TO]->(wb:WaterBody {id: $wb_id})
            WHERE r.task_id = $task_id
            RETURN o.name AS officer_name, r.priority AS priority, r.status AS status
            """
            record = session.run(query, wb_id=wb_target, task_id=str(task_id)).single()
            assert record is not None, "Neo4j (:Officer)-[:ASSIGNED_TO]->(:WaterBody) relationship missing"
            assert record["priority"] == "HIGH"
            assert record["status"] == "PENDING"

# --- TEST 9: Dedicated /api/tasks/assign & /api/tasks/list Fetch Route Verification ---
def test_tasks_assign_and_list_fetch_routes():
    headers = get_admin_auth_header()
    wb_target = "38295"
    officer_target = "Officer S. Anitha"
    
    # 1. Dispatch Task via /api/tasks/assign
    dispatch_payload = {
        "water_body_id": wb_target,
        "officer_name": officer_target,
        "priority": "HIGH",
        "task_description": "Dedicated tasks endpoint verification test"
    }
    res = client.post("/api/tasks/assign", json=dispatch_payload, headers=headers)
    assert res.status_code == 200
    res_data = res.json()
    assert "task_id" in res_data
    task_id = res_data["task_id"]

    # 2. Fetch tasks list via /api/tasks/list
    list_res = client.get("/api/tasks/list", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["status"] == "SUCCESS"
    assert list_data["count"] > 0
    task_ids = [row["task_id"] for row in list_data["data"]]
    assert task_id in task_ids, f"Task #{task_id} missing from /api/tasks/list response"

if __name__ == "__main__":
    pytest.main(["-v", __file__])

