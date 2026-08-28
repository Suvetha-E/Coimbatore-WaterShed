"""
app/api/auth.py
---------------
Firebase Authentication and User Account Synchronization Router.
Includes Officer Approval Workflow endpoints for Admins and Activity Audit Logging.
"""

import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status, Body
from app.database.spatialite import (
    get_user_by_username,
    sync_or_create_user,
    get_pending_officers,
    update_officer_approval_status,
    log_activity
)
from app.security import (
    verify_password,
    get_current_user,
    require_admin
)

router = APIRouter(prefix="/auth", tags=["Authentication & User Management"])
logger = logging.getLogger("app.api.auth")

class SyncUserRequest(BaseModel):
    firebase_uid: str = Field(..., description="Firebase Unique User ID")
    email: str = Field(..., description="User Email Address")
    name: str = Field(..., description="User Full Name")
    phone: Optional[str] = Field(None, description="Contact Phone Number")
    role: str = Field("CITIZEN", description="Requested Role ('ADMIN', 'OFFICER', 'CITIZEN')")

class ApproveOfficerRequest(BaseModel):
    user_id: int = Field(..., description="SQLite User ID of pending officer")
    approval_status: str = Field(..., description="'approved' or 'rejected'")

class LoginRequest(BaseModel):
    username: Optional[str] = Field(None, description="User account username or email")
    email: Optional[str] = Field(None, description="User account email address")
    password: str = Field(..., description="User plaintext password")

@router.post("/sync-user", summary="Sync Firebase Account with Database")
def sync_user(payload: SyncUserRequest):
    """
    Synchronizes Firebase Web SDK user profile with SQLite database.
    If requested role is OFFICER, default status is set to 'pending' until admin approves.
    """
    try:
        user = sync_or_create_user(
            email=payload.email,
            name=payload.name,
            firebase_uid=payload.firebase_uid,
            role=payload.role,
            phone=payload.phone
        )
        
        log_activity(
            user_email=payload.email,
            user_role=user['role'],
            action_category=user['role'],
            action_type="USER_SYNC",
            description=f"User signed in / profile synchronized (Role: {user['role']}, Status: {user['approval_status']})",
            target_id=str(user['id'])
        )

        logger.info(f"Synchronized Firebase user '{payload.email}' (Role: {user['role']}, Status: {user['approval_status']}).")
        return {
            "status": "SUCCESS",
            "user": {
                "id": user["id"],
                "firebase_uid": user["firebase_uid"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "approval_status": user["approval_status"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        if "UNIQUE constraint" in str(e) or "integrity" in str(e).lower():
            raise HTTPException(status_code=400, detail="An account with this email or username already exists. Please sign in instead.")
        logger.error(f"Error syncing user profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to synchronize user profile: {str(e)}")

@router.get("/me", summary="Get Current Authenticated User Profile")
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns profile details and approval status of current authenticated user."""
    return {
        "id": current_user.get("id"),
        "firebase_uid": current_user.get("firebase_uid"),
        "email": current_user.get("email"),
        "name": current_user.get("name") or current_user.get("full_name"),
        "role": current_user.get("role", "CITIZEN"),
        "approval_status": current_user.get("approval_status", "approved"),
        "created_at": str(current_user.get("created_at", ""))
    }

@router.get("/pending-officers", summary="List Pending Officer Registrations (Admin Only)")
def list_pending_officers(admin_user: dict = Depends(require_admin)):
    """Returns all field officer accounts awaiting administrator approval."""
    pending = get_pending_officers()
    logger.info(f"Admin '{admin_user.get('email')}' retrieved {len(pending)} pending officer requests.")
    return pending

@router.post("/approve-officer", summary="Approve or Reject Officer Account (Admin Only)")
def approve_officer(payload: ApproveOfficerRequest, admin_user: dict = Depends(require_admin)):
    """Allows watershed admins to approve or reject pending field officer registrations."""
    if payload.approval_status.lower() not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'approved' or 'rejected'.")
        
    success = update_officer_approval_status(payload.user_id, payload.approval_status)
    if not success:
        raise HTTPException(status_code=404, detail=f"User ID #{payload.user_id} not found.")

    # Audit log entry for admin officer approval
    log_activity(
        user_email=admin_user.get("email", "admin@watershed.tn.gov.in"),
        user_role="ADMIN",
        action_category="ADMIN",
        action_type="OFFICER_APPROVAL",
        description=f"Admin {payload.approval_status.upper()} Field Officer Registration for User #{payload.user_id}",
        target_id=str(payload.user_id)
    )

    logger.info(f"Admin '{admin_user.get('email')}' set approval status for user #{payload.user_id} to '{payload.approval_status}'.")
    return {
        "status": "SUCCESS",
        "user_id": payload.user_id,
        "approval_status": payload.approval_status.lower(),
        "message": f"Officer registration set to {payload.approval_status.upper()}."
    }

@router.post("/login", summary="Authenticate Demo Account & Issue Token")
def login(payload: LoginRequest):
    """
    Authentication endpoint supporting both username and email credentials.
    Checks active database users, synchronizes active account, and returns JWT session token.
    """
    try:
        user_identifier = payload.username or payload.email
        if not user_identifier:
            raise HTTPException(status_code=400, detail="Please provide a valid username or email address.")

        user = get_user_by_username(user_identifier)
        if not user and "@" in user_identifier:
            from app.database.spatialite import get_user_by_email
            user = get_user_by_email(user_identifier)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account not found. Please register an account first before signing in."
            )

        # Check password hash if stored
        if user.get("hashed_password") and len(user["hashed_password"]) > 0:
            if not verify_password(payload.password, user["hashed_password"]):
                raise HTTPException(status_code=401, detail="Invalid credentials. Password verification failed.")

        from app.security import SECRET_KEY, ALGORITHM
        import jwt
        from datetime import datetime, timedelta, timezone
        
        expire = datetime.now(timezone.utc) + timedelta(hours=24)
        token_payload = {
            "sub": user["email"],
            "email": user["email"],
            "uid": user.get("firebase_uid") or str(user["id"]),
            "role": user["role"],
            "approval_status": user.get("approval_status", "approved"),
            "exp": expire
        }
        token = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)
        
        log_activity(
            user_email=user["email"],
            user_role=user["role"],
            action_category=user["role"],
            action_type="USER_LOGIN",
            description=f"User logged in to session as {user['role']}",
            target_id=str(user["id"])
        )

        logger.info(f"User '{user['email']}' successfully authenticated (Role: {user['role']}).")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "approval_status": user.get("approval_status", "approved")
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during authentication for user '{payload.username or payload.email}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Authentication processing error: {str(e)}")
