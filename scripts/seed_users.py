"""
seed_users.py
-------------
Seeds the database with default RBAC user accounts:
- Admin: admin_cbe / admin123
- Officer: officer_ramesh / officer123
- Officer: officer_anitha / officer123
- Citizen: citizen_muthu / citizen123
"""

import sys
import hashlib
import os
import logging
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.database.spatialite import init_db, get_user_by_username, insert_user

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("seed_users")

def hash_password(password: str, salt: bytes = None) -> str:
    """Hashes password using PBKDF2-HMAC-SHA256."""
    if salt is None:
        salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"{salt.hex()}:{hashed.hex()}"

DEFAULT_USERS = [
    {
        "username": "admin_cbe",
        "password": "admin123",
        "role": "ADMIN",
        "full_name": "Coimbatore Watershed Administrator"
    },
    {
        "username": "officer_ramesh",
        "password": "officer123",
        "role": "OFFICER",
        "full_name": "Officer V. Ramesh (Sulur Zone)"
    },
    {
        "username": "officer_anitha",
        "password": "officer123",
        "role": "OFFICER",
        "full_name": "Officer S. Anitha (Pollachi Sector)"
    },
    {
        "username": "citizen_muthu",
        "password": "citizen123",
        "role": "CITIZEN",
        "full_name": "K. Muthusamy (Local Farmer)"
    }
]

def seed_users():
    logger.info("Initializing DB schema for user accounts...")
    init_db()

    seeded_count = 0
    for u in DEFAULT_USERS:
        existing = get_user_by_username(u["username"])
        if not existing:
            hashed_pwd = hash_password(u["password"])
            insert_user(u["username"], hashed_pwd, u["role"], u["full_name"])
            logger.info(f"Seeded user '{u['username']}' with role '{u['role']}'.")
            seeded_count += 1
        else:
            logger.info(f"User '{u['username']}' already exists.")

    logger.info(f"=== User Seeding Complete ({seeded_count} new users added) ===")

if __name__ == "__main__":
    seed_users()
