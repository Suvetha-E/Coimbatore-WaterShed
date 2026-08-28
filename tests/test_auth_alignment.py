"""
tests/test_auth_alignment.py
------------------------------
Unit tests for Firebase and SQLite Authentication Alignment & Registration-First Enforcement.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
import jwt
from app.security import SECRET_KEY, ALGORITHM

client = TestClient(app)

def test_unregistered_login_rejection():
    """Verify that an unregistered user cannot log in and receives an HTTP 401 error."""
    unregistered_payload = {
        "username": "non_existent_user_999@watershed.tn.gov.in",
        "password": "somepassword123"
    }
    res = client.post("/api/auth/login", json=unregistered_payload)
    assert res.status_code == 401
    assert "Account not found" in res.json()["detail"]

def test_registered_user_sync_and_login():
    """Verify that after user registration/sync, the user can successfully log in."""
    reg_payload = {
        "firebase_uid": "test_aligned_uid_777",
        "email": "registered_farmer@watershed.tn.gov.in",
        "name": "Registered Farmer",
        "phone": "+919876543210",
        "role": "CITIZEN"
    }
    sync_res = client.post("/api/auth/sync-user", json=reg_payload)
    assert sync_res.status_code == 200
    assert sync_res.json()["status"] == "SUCCESS"

    login_res = client.post("/api/auth/login", json={
        "username": "registered_farmer@watershed.tn.gov.in",
        "password": "password123"
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()
    assert login_res.json()["user"]["email"] == "registered_farmer@watershed.tn.gov.in"

def test_unregistered_token_verification_rejection():
    """Verify that a JWT token for an unregistered UID/email is rejected by get_current_user middleware."""
    fake_token_payload = {
        "sub": "completely_fake_unregistered_user@watershed.tn.gov.in",
        "uid": "fake_unregistered_uid_000",
        "role": "CITIZEN",
        "approval_status": "approved"
    }
    fake_token = jwt.encode(fake_token_payload, SECRET_KEY, algorithm=ALGORITHM)
    
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert res.status_code == 401
    assert "Unregistered user account" in res.json()["detail"]

def test_duplicate_user_registration_graceful_handling():
    """Verify that registering a user with an existing email or derived username handles unique constraints gracefully."""
    payload = {
        "firebase_uid": "test_unique_uid_101",
        "email": "unique_test_farmer@watershed.tn.gov.in",
        "name": "Unique Test Farmer",
        "phone": "+919876543210",
        "role": "CITIZEN"
    }
    res1 = client.post("/api/auth/sync-user", json=payload)
    assert res1.status_code == 200

    # Repeat registration with same email / different UID
    payload2 = {
        "firebase_uid": "test_unique_uid_102",
        "email": "unique_test_farmer@watershed.tn.gov.in",
        "name": "Unique Test Farmer Updated",
        "phone": "+919876543210",
        "role": "CITIZEN"
    }
    res2 = client.post("/api/auth/sync-user", json=payload2)
    assert res2.status_code in [200, 400]
    if res2.status_code == 200:
        assert res2.json()["user"]["email"] == "unique_test_farmer@watershed.tn.gov.in"

