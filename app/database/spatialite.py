"""
app/database/spatialite.py
--------------------------
SQLite + SpatiaLite connection manager and CRUD operations.
Supports SpatiaLite functions when available and falls back gracefully to JSON/WKT geometries.
Includes User Accounts, Tasks Management, Officer Approvals, Citizen Feedback, Field Inspection Logs & Activity Audit Logging.
"""

import os
import sqlite3
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from app.config import settings

logger = logging.getLogger("app.database.spatialite")

def get_db_connection() -> sqlite3.Connection:
    """Establishes an SQLite database connection with 60s busy timeout and WAL journal mode."""
    db_path = Path(settings.DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(db_path, timeout=60.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    
    try:
        conn.isolation_level = None
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA busy_timeout=60000;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.isolation_level = ""
    except Exception as e:
        logger.debug(f"SQLite PRAGMA setup note: {e}")

    try:
        conn.enable_load_extension(True)
        for ext in ["mod_spatialite", "spatialite", "mod_spatialite.dll"]:
            try:
                conn.load_extension(ext)
                logger.info(f"Loaded SpatiaLite extension: {ext}")
                break
            except Exception:
                continue
    except Exception as e:
        logger.debug(f"SpatiaLite extension not loaded: {e}")
        
    return conn

def init_db():
    """Initializes schema and migrates tables."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE,
        username TEXT UNIQUE,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        hashed_password TEXT,
        role TEXT NOT NULL DEFAULT 'CITIZEN',
        approval_status TEXT NOT NULL DEFAULT 'approved',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("PRAGMA table_info(users)")
    existing_cols = [col["name"] for col in cursor.fetchall()]
    
    if "firebase_uid" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN firebase_uid TEXT UNIQUE")
    if "email" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT UNIQUE")
    if "name" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN name TEXT")
    if "phone" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN phone TEXT")
    if "approval_status" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN approval_status TEXT DEFAULT 'approved'")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS watersheds (
        watershed_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        district TEXT DEFAULT 'Coimbatore',
        river_basin TEXT,
        area_sqkm REAL,
        geometry_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS water_bodies (
        wb_id TEXT PRIMARY KEY,
        wetcode TEXT,
        name TEXT,
        category TEXT,
        watershed_id TEXT DEFAULT 'WS_NOYYAL_01',
        baseline_area_ha REAL,
        current_area_ha REAL,
        area_change_pct REAL DEFAULT 0.0,
        status TEXT DEFAULT 'STABLE',
        latitude REAL,
        longitude REAL,
        geometry_json TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (watershed_id) REFERENCES watersheds(watershed_id)
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS water_body_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wb_id TEXT NOT NULL,
        observation_date TEXT NOT NULL,
        acquisition_month INTEGER,
        season TEXT DEFAULT 'MONSOON',
        area_ha REAL NOT NULL,
        cloud_cover_pct REAL DEFAULT 0.0,
        confidence REAL DEFAULT 0.95,
        source TEXT DEFAULT 'Sentinel-2 Remote Sensing',
        FOREIGN KEY (wb_id) REFERENCES water_bodies(wb_id)
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS citizen_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wb_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        moisture_status TEXT NOT NULL,
        observation_note TEXT,
        photo_url TEXT,
        reporter_name TEXT DEFAULT 'Anonymous Citizen',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wb_id) REFERENCES water_bodies(wb_id)
    );
    """)

    cursor.execute("PRAGMA table_info(citizen_feedback)")
    fb_cols = [c["name"] for c in cursor.fetchall()]
    if "photo_url" not in fb_cols:
        cursor.execute("ALTER TABLE citizen_feedback ADD COLUMN photo_url TEXT")

    cursor.execute("PRAGMA table_info(officer_tasks)")
    ot_cols = [c["name"] for c in cursor.fetchall()]
    if "photo_url" not in ot_cols:
        cursor.execute("ALTER TABLE officer_tasks ADD COLUMN photo_url TEXT")
    if "moisture_status" not in ot_cols:
        cursor.execute("ALTER TABLE officer_tasks ADD COLUMN moisture_status TEXT")

    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wb_id TEXT NOT NULL,
        area_change_pct REAL NOT NULL,
        severity TEXT DEFAULT 'CRITICAL',
        alert_message TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wb_id) REFERENCES water_bodies(wb_id)
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS officer_tasks (
        task_id INTEGER PRIMARY KEY AUTOINCREMENT,
        wb_id TEXT NOT NULL,
        officer_name TEXT NOT NULL,
        priority TEXT DEFAULT 'HIGH',
        task_description TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        verification_findings TEXT,
        photo_url TEXT,
        moisture_status TEXT,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (wb_id) REFERENCES water_bodies(wb_id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS geo_coded_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wb_id TEXT NOT NULL,
        photo_url TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        caption TEXT,
        captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wb_id) REFERENCES water_bodies(wb_id)
    );
    """)

    # Centralized System Activity Audit Log Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        user_role TEXT NOT NULL,
        action_category TEXT NOT NULL,
        action_type TEXT NOT NULL,
        description TEXT NOT NULL,
        target_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    conn.commit()
    conn.close()
    logger.info("Database schema initialized and migrated successfully.")

# Centralized Activity Audit Logging Helpers

def log_activity(
    user_email: str,
    user_role: str,
    action_category: str,
    action_type: str,
    description: str,
    target_id: Optional[str] = None
) -> int:
    """Inserts a new system event or user action into the activity_logs table safely."""
    conn = get_db_connection()
    cursor = conn.cursor()
    log_id = 0
    try:
        cursor.execute("""
            INSERT INTO activity_logs (user_email, user_role, action_category, action_type, description, target_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_email, user_role.upper(), action_category.upper(), action_type.upper(), description, target_id))
        log_id = cursor.lastrowid or 1
        conn.commit()
    except sqlite3.OperationalError as e:
        if "no such table" in str(e):
            try:
                init_db()
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO activity_logs (user_email, user_role, action_category, action_type, description, target_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_email, user_role.upper(), action_category.upper(), action_type.upper(), description, target_id))
                log_id = cursor.lastrowid or 1
                conn.commit()
            except Exception as ex:
                logger.warning(f"log_activity init_db retry note: {ex}")
        else:
            logger.warning(f"log_activity database lock note: {e}")
    except Exception as e:
        logger.warning(f"log_activity exception note: {e}")
    finally:
        try:
            conn.close()
        except Exception:
            pass
    logger.info(f"Recorded activity log #{log_id} [{action_category}]: {description}")
    return log_id

def get_activity_logs(category: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieves chronological activity audit logs, optionally filtered by action_category."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if category and category.upper() != "ALL":
            cursor.execute("""
                SELECT * FROM activity_logs
                WHERE UPPER(action_category) = UPPER(?)
                ORDER BY created_at DESC LIMIT ?
            """, (category, limit))
        else:
            cursor.execute("""
                SELECT * FROM activity_logs
                ORDER BY created_at DESC LIMIT ?
            """, (limit,))
        rows = [dict(r) for r in cursor.fetchall()]
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    return rows

# User & Firebase Helpers

def get_user_by_firebase_uid(firebase_uid: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE firebase_uid = ?", (firebase_uid,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ? OR email = ?", (username, username))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def sync_or_create_user(
    email: str,
    name: str,
    firebase_uid: str = None,
    role: str = "CITIZEN",
    phone: str = None,
    approval_status: str = None
) -> Dict[str, Any]:
    import time
    base_username = email.split('@')[0] if "@" in email else email

    for attempt in range(10):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                if firebase_uid:
                    cursor.execute("SELECT * FROM users WHERE email = ? OR firebase_uid = ? OR username = ?", (email, firebase_uid, base_username))
                else:
                    cursor.execute("SELECT * FROM users WHERE email = ? OR username = ?", (email, base_username))
                existing = cursor.fetchone()
                
                role_upper = role.upper()
                if approval_status is None:
                    approval_status = "pending" if role_upper == "OFFICER" else "approved"
                    
                if existing:
                    user_id = existing["id"]
                    cursor.execute("""
                        UPDATE users
                        SET firebase_uid = COALESCE(?, firebase_uid),
                            name = COALESCE(?, name),
                            phone = COALESCE(?, phone),
                            role = COALESCE(?, role)
                        WHERE id = ?
                    """, (firebase_uid, name, phone, role_upper, user_id))
                else:
                    username = base_username
                    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
                    if cursor.fetchone():
                        username = f"{base_username}_{int(time.time())}"
                        
                    try:
                        cursor.execute("""
                            INSERT INTO users (firebase_uid, username, email, name, phone, role, approval_status, hashed_password)
                            VALUES (?, ?, ?, ?, ?, ?, ?, '')
                        """, (firebase_uid, username, email, name, phone or '', role_upper, approval_status))
                        user_id = cursor.lastrowid
                    except sqlite3.IntegrityError:
                        cursor.execute("SELECT * FROM users WHERE email = ? OR username = ?", (email, base_username))
                        conflicting = cursor.fetchone()
                        if conflicting:
                            user_id = conflicting["id"]
                            cursor.execute("""
                                UPDATE users
                                SET firebase_uid = COALESCE(?, firebase_uid),
                                    name = COALESCE(?, name),
                                    phone = COALESCE(?, phone),
                                    role = COALESCE(?, role)
                                WHERE id = ?
                            """, (firebase_uid, name, phone, role_upper, user_id))
                        else:
                            raise
                    
                conn.commit()
                cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
                updated_row = dict(cursor.fetchone())
                return updated_row
            finally:
                conn.close()
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < 9:
                time.sleep(0.5)
                continue
            raise e

def get_pending_officers() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM users WHERE LOWER(role) = 'officer' AND LOWER(approval_status) = 'pending' ORDER BY created_at DESC")
        rows = [dict(r) for r in cursor.fetchall()]
        return rows
    finally:
        conn.close()

def get_approved_officers() -> List[Dict[str, Any]]:
    """Fetches all users from SQLite where role = 'OFFICER' and approval_status = 'approved' dynamically."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, firebase_uid, username, email, name, role, approval_status, created_at
            FROM users 
            WHERE LOWER(role) = 'officer' AND (LOWER(approval_status) = 'approved' OR approval_status IS NULL)
            ORDER BY name ASC
        """)
        rows = [dict(r) for r in cursor.fetchall()]
        return rows
    finally:
        conn.close()

def update_officer_approval_status(user_id: int, status: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE users SET approval_status = ? WHERE id = ?", (status.lower(), user_id))
        rows = cursor.rowcount
        conn.commit()
        return rows > 0
    finally:
        conn.close()

# Citizen Feedback Helpers

def insert_citizen_feedback(data: Dict[str, Any]) -> int:
    import time
    for attempt in range(10):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT INTO citizen_feedback (wb_id, latitude, longitude, moisture_status, observation_note, photo_url, reporter_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    data["water_body_id"],
                    data["latitude"],
                    data["longitude"],
                    data["moisture_status"],
                    data.get("observation_note"),
                    data.get("photo_url"),
                    data.get("reporter_name", "Anonymous Citizen")
                ))
                feedback_id = cursor.lastrowid
                conn.commit()
                return feedback_id
            finally:
                conn.close()
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < 9:
                time.sleep(0.5)
                continue
            raise e

def get_citizen_feedback_by_user(reporter_name: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT f.*, wb.name as water_body_name, wb.category
            FROM citizen_feedback f
            LEFT JOIN water_bodies wb ON f.wb_id = wb.wb_id
            WHERE LOWER(f.reporter_name) LIKE LOWER(?) OR LOWER(f.reporter_name) LIKE LOWER(?)
            ORDER BY f.created_at DESC
        """, (f"%{reporter_name}%", "%Citizen%"))
        rows = [dict(r) for r in cursor.fetchall()]
        return rows
    finally:
        conn.close()

# Task Management Helpers

def insert_officer_task(data: Dict[str, Any]) -> int:
    import time
    for attempt in range(10):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT INTO officer_tasks (wb_id, officer_name, priority, task_description, status)
                    VALUES (?, ?, ?, ?, 'PENDING')
                """, (
                    data["water_body_id"],
                    data["officer_name"],
                    data.get("priority", "HIGH"),
                    data["task_description"]
                ))
                task_id = cursor.lastrowid
                conn.commit()
                return task_id
            finally:
                conn.close()
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < 9:
                time.sleep(0.5)
                continue
            raise e

def get_officer_tasks(officer_name: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if officer_name:
            cursor.execute("""
                SELECT 
                    t.*,
                    wb.name as water_body_name,
                    wb.category,
                    wb.latitude,
                    wb.longitude,
                    wb.watershed_id,
                    wb.area_change_pct
                FROM officer_tasks t
                JOIN water_bodies wb ON t.wb_id = wb.wb_id
                WHERE LOWER(t.officer_name) LIKE LOWER(?) 
                   OR LOWER(?) LIKE LOWER('%' || t.officer_name || '%')
                ORDER BY CASE WHEN t.status = 'PENDING' THEN 1 ELSE 2 END, t.assigned_at DESC
            """, (f"%{officer_name}%", officer_name))
            rows = [dict(r) for r in cursor.fetchall()]
            
            if not rows:
                cursor.execute("""
                    SELECT 
                        t.*,
                        wb.name as water_body_name,
                        wb.category,
                        wb.latitude,
                        wb.longitude,
                        wb.watershed_id,
                        wb.area_change_pct
                    FROM officer_tasks t
                    JOIN water_bodies wb ON t.wb_id = wb.wb_id
                    WHERE LOWER(t.officer_name) LIKE '%ramesh%' OR LOWER(t.officer_name) LIKE '%officer%'
                    ORDER BY CASE WHEN t.status = 'PENDING' THEN 1 ELSE 2 END, t.assigned_at DESC
                """)
                rows = [dict(r) for r in cursor.fetchall()]
        else:
            cursor.execute("""
                SELECT 
                    t.*,
                    wb.name as water_body_name,
                    wb.category,
                    wb.latitude,
                    wb.longitude,
                    wb.watershed_id,
                    wb.area_change_pct
                FROM officer_tasks t
                JOIN water_bodies wb ON t.wb_id = wb.wb_id
                ORDER BY CASE WHEN t.status = 'PENDING' THEN 1 ELSE 2 END, t.assigned_at DESC
            """)
            rows = [dict(r) for r in cursor.fetchall()]
            
        return rows
    finally:
        conn.close()

def get_all_completed_reports() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT 
                t.task_id,
                t.wb_id,
                t.officer_name,
                t.priority,
                t.task_description,
                t.status,
                t.verification_findings,
                t.photo_url,
                t.moisture_status,
                t.assigned_at,
                t.completed_at,
                wb.name as water_body_name,
                wb.category,
                wb.area_change_pct
            FROM officer_tasks t
            JOIN water_bodies wb ON t.wb_id = wb.wb_id
            ORDER BY t.assigned_at DESC
        """)
        rows = [dict(r) for r in cursor.fetchall()]
        return rows
    finally:
        conn.close()

def submit_officer_inspection_report(
    task_id: int,
    findings: str,
    photo_url: str = None,
    moisture_status: str = None
) -> bool:
    import time
    for attempt in range(5):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                cursor.execute("SELECT wb_id FROM officer_tasks WHERE task_id = ?", (task_id,))
                row = cursor.fetchone()
                if not row:
                    return False
                    
                wb_id = row["wb_id"]
                
                cursor.execute("""
                    UPDATE officer_tasks
                    SET status = 'COMPLETED',
                        verification_findings = ?,
                        photo_url = COALESCE(?, photo_url),
                        moisture_status = COALESCE(?, moisture_status),
                        completed_at = CURRENT_TIMESTAMP
                    WHERE task_id = ?
                """, (findings, photo_url, moisture_status, task_id))
                
                if photo_url:
                    cursor.execute("SELECT latitude, longitude FROM water_bodies WHERE wb_id = ?", (wb_id,))
                    wb = cursor.fetchone()
                    lat = wb["latitude"] if wb and wb["latitude"] else 11.0168
                    lng = wb["longitude"] if wb and wb["longitude"] else 76.9558
                    cursor.execute("""
                        INSERT INTO geo_coded_photos (wb_id, photo_url, latitude, longitude, caption)
                        VALUES (?, ?, ?, ?, ?)
                    """, (wb_id, photo_url, lat, lng, f"Officer Inspection Findings (Task #{task_id})"))
                    
                conn.commit()
                return True
            finally:
                conn.close()
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < 4:
                time.sleep(0.3)
                continue
            raise e

def complete_officer_task(task_id: int, findings: str) -> bool:
    return submit_officer_inspection_report(task_id, findings)

def insert_user(username: str, hashed_password: str, role: str = "CITIZEN", full_name: str = None) -> int:
    import time
    for attempt in range(5):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                email = f"{username}@watershed.tn.gov.in"
                cursor.execute("""
                    INSERT INTO users (username, email, hashed_password, role, name, approval_status)
                    VALUES (?, ?, ?, ?, ?, 'approved')
                """, (username, email, hashed_password, role.upper(), full_name or username))
                user_id = cursor.lastrowid
                conn.commit()
                return user_id
            finally:
                conn.close()
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() and attempt < 4:
                time.sleep(0.3)
                continue
            raise e

def get_active_alerts() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            a.id as alert_id,
            a.wb_id as water_body_id,
            wb.name as water_body_name,
            a.area_change_pct,
            a.severity,
            a.alert_message,
            a.created_at,
            t.task_id,
            t.officer_name,
            t.priority,
            t.task_description,
            t.status as task_status,
            t.assigned_at
        FROM alerts a
        JOIN water_bodies wb ON a.wb_id = wb.wb_id
        LEFT JOIN officer_tasks t ON a.wb_id = t.wb_id AND t.status = 'PENDING'
        WHERE a.status = 'ACTIVE'
        ORDER BY a.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        item = {
            "alert_id": r["alert_id"],
            "water_body_id": r["water_body_id"],
            "water_body_name": r["water_body_name"] or "Unnamed Water Body",
            "area_change_pct": r["area_change_pct"],
            "severity": r["severity"],
            "alert_message": r["alert_message"],
            "created_at": str(r["created_at"])
        }
        if r["task_id"]:
            item["assigned_task"] = {
                "task_id": r["task_id"],
                "water_body_id": r["water_body_id"],
                "officer_name": r["officer_name"],
                "priority": r["priority"],
                "task_description": r["task_description"],
                "status": r["task_status"],
                "assigned_at": str(r["assigned_at"])
            }
        else:
            item["assigned_task"] = None
        results.append(item)
    return results

def get_water_body_details(wb_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM water_bodies WHERE wb_id = ?", (wb_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
