"""
tests/test_backend.py
---------------------
Pytest unit tests for FastAPI backend endpoints, Firebase Authentication integration, and RBAC role permissions.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Helper function to obtain token for testing
def get_auth_header(username="admin_cbe", password="admin123"):
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["auth_enabled"] is True

def test_sync_user_endpoint():
    payload = {
        "firebase_uid": "test_firebase_uid_12345",
        "email": "test_farmer@watershed.tn.gov.in",
        "name": "Test Farmer Citizen",
        "phone": "+919876543210",
        "role": "CITIZEN"
    }
    res = client.post("/api/auth/sync-user", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["user"]["email"] == "test_farmer@watershed.tn.gov.in"

def test_user_login_success():
    res = client.post("/api/auth/login", json={"username": "admin_cbe", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"

def test_auth_me_endpoint():
    headers = get_auth_header("officer_ramesh", "officer123")
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "OFFICER"

def test_unauthenticated_protected_endpoint():
    res = client.get("/api/officer/alerts")
    assert res.status_code == 401

def test_rbac_officer_alerts_access():
    headers = get_auth_header("officer_ramesh", "officer123")
    res = client.get("/api/officer/alerts", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_rbac_admin_task_assignment_forbidden_for_officer():
    headers = get_auth_header("officer_ramesh", "officer123")
    payload = {
        "water_body_id": "38295",
        "officer_name": "Officer S. Anitha",
        "priority": "HIGH",
        "task_description": "Unauthorized task assignment attempt"
    }
    res = client.post("/api/admin/assign-task", json=payload, headers=headers)
    assert res.status_code == 403

def test_rbac_admin_task_assignment_success():
    headers = get_auth_header("admin_cbe", "admin123")
    payload = {
        "water_body_id": "38295",
        "officer_name": "Officer S. Anitha",
        "priority": "HIGH",
        "task_description": "Authorized task assignment by admin"
    }
    res = client.post("/api/admin/assign-task", json=payload, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "PENDING"

def test_public_water_bodies_geojson():
    res = client.get("/api/water-bodies")
    assert res.status_code == 200
    assert res.json()["type"] == "FeatureCollection"

def test_neo4j_health_endpoint():
    res = client.get("/health/neo4j")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert data["status"] in ["ONLINE", "FALLBACK"]
    assert "connected" in data

    res_v1 = client.get("/api/v1/health/neo4j")
    assert res_v1.status_code == 200
    assert res_v1.json()["status"] == data["status"]

def test_root_cause_analysis_pipeline():
    res = client.get("/api/water-body/13734/root-cause-analysis")
    assert res.status_code == 200
    payload = res.json()
    assert "alert_id" in payload
    assert "target_water_body" in payload
    assert payload["target_water_body"]["water_body_id"] == "13734"
    assert "spatial_watershed_context" in payload
    assert "assigned_district_officer" in payload
    assert "parameter_evaluation" in payload
    assert "llm_root_cause_analysis" in payload
    assert "actionable_recommendations" in payload
    assert "primary_root_cause" in payload["llm_root_cause_analysis"]
    assert "detailed_explanation" in payload["llm_root_cause_analysis"]

from app.graph.neo4j_bulk_loader import run_neo4j_bulk_ingestion

def test_bulk_loader_and_admin_seed():
    res = run_neo4j_bulk_ingestion()
    assert "status" in res
    assert res["status"] in ["COMPLETED", "FALLBACK"]

    headers = get_auth_header("admin_cbe", "admin123")
    api_res = client.post("/api/admin/seed-neo4j", headers=headers)
    assert api_res.status_code == 200
def test_sql_tables_summary_endpoint():
    headers = get_auth_header("admin_cbe", "admin123")
    res = client.get("/api/admin/sql/tables-summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert "tables" in data
    assert len(data["tables"]) >= 7
    table_names = [t["name"] for t in data["tables"]]
    assert "water_bodies" in table_names
    assert "users" in table_names
    assert "activity_logs" in table_names

def test_sql_table_data_endpoint():
    headers = get_auth_header("admin_cbe", "admin123")
    res = client.get("/api/admin/sql/table-data?table_name=users&limit=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["table_name"] == "users"
    assert "columns" in data
    assert "data" in data
    assert len(data["data"]) > 0
    assert "email" in data["columns"]




