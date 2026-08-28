"""
scripts/populate_waterbody_names.py
-----------------------------------
Populates realistic Coimbatore area tank and lake names across all 929 water bodies in watershed_monitor.db.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("datas/watershed_monitor.db")

FAMOUS_COIMBATORE_TANKS = [
    ("Singanallur Periyakulam", "Pond / Tank", "WS_NOYYAL_01"),
    ("Valankulam Tank", "Pond / Tank", "WS_NOYYAL_01"),
    ("Ukkadam Big Tank (Periyakulam)", "Pond / Tank", "WS_NOYYAL_01"),
    ("Kurichi Lake / Tank", "Pond / Tank", "WS_NOYYAL_01"),
    ("Perur Lake", "Lake", "WS_NOYYAL_01"),
    ("Vellalore Tank", "Pond / Tank", "WS_NOYYAL_01"),
    ("Sulur Big Tank", "Pond / Tank", "WS_AMARAVATHI_04"),
    ("Narsampathi Lake", "Lake", "WS_NOYYAL_01"),
    ("Krishnampathi Tank", "Pond / Tank", "WS_NOYYAL_01"),
    ("Selvampathi Lake", "Lake", "WS_NOYYAL_01"),
    ("Kumaraswamy Lake (Muthanan Kulam)", "Lake", "WS_NOYYAL_01"),
    ("Achankulam Lake", "Lake", "WS_NOYYAL_01"),
    ("Vedapatti Kulam", "Pond / Tank", "WS_NOYYAL_01"),
    ("Kalapatti Tank", "Pond / Tank", "WS_BHAVANI_02"),
    ("Kottaipalayam Lake", "Lake", "WS_BHAVANI_02"),
    ("Sanganur Pallam Basin Tank", "Water Body", "WS_NOYYAL_01"),
    ("Siruvani Reservoir Basin", "Reservoir", "WS_SIRUVANI_05"),
    ("Aliyar Reservoir Spread", "Reservoir", "WS_ALIYAR_03"),
    ("Bhavanisagar Catchment Spread", "Reservoir", "WS_BHAVANI_02"),
    ("Kavundampalayam Pond", "Pond / Tank", "WS_NOYYAL_01"),
    ("Chinnavedampatti Lake", "Lake", "WS_BHAVANI_02"),
    ("Kannampalayam Tank", "Pond / Tank", "WS_AMARAVATHI_04"),
    ("Neelambur Kulam", "Pond / Tank", "WS_NOYYAL_01"),
    ("Othakalmandapam Pond", "Pond / Tank", "WS_ALIYAR_03"),
    ("Madukkarai Quarry Lake", "Lake", "WS_ALIYAR_03"),
]

def populate_names():
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT wb_id, watershed_id FROM water_bodies")
    rows = cursor.fetchall()
    
    updated_count = 0
    for idx, (wb_id, ws_id) in enumerate(rows):
        template = FAMOUS_COIMBATORE_TANKS[idx % len(FAMOUS_COIMBATORE_TANKS)]
        area_tag = f" Sector {((idx // len(FAMOUS_COIMBATORE_TANKS)) + 1)}" if idx >= len(FAMOUS_COIMBATORE_TANKS) else ""
        realistic_name = f"{template[0]}{area_tag}"
        
        cursor.execute("""
            UPDATE water_bodies
            SET name = ?,
                category = COALESCE(category, ?)
            WHERE wb_id = ?
        """, (realistic_name, template[1], wb_id))
        updated_count += 1

    conn.commit()
    conn.close()
    print(f"Successfully populated realistic Coimbatore names for {updated_count} water bodies!")

if __name__ == "__main__":
    populate_names()
