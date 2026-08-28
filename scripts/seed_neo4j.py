"""
scripts/seed_neo4j.py
---------------------
CLI Script for manually triggering Neo4j bulk loading from GeoJSON datasets.

Usage:
  python scripts/seed_neo4j.py
"""

import sys
import json
import logging
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.graph.neo4j_bulk_loader import run_neo4j_bulk_ingestion

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("scripts.seed_neo4j")

def main():
    logger.info("Starting Neo4j GeoJSON Bulk Dataset Seeding...")
    result = run_neo4j_bulk_ingestion()
    print("\n--- Neo4j Ingestion Summary ---")
    print(json.dumps(result, indent=2))
    print("-------------------------------\n")

if __name__ == "__main__":
    main()
