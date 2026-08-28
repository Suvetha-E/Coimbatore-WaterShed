"""
generate_watersheds.py
----------------------
Generates Coimbatore Watershed Catchment Boundaries and spatially links 
all water bodies to their corresponding watershed catchment.

Outputs:
- datas/processed/coimbatore_watersheds.geojson
- Updated datas/processed/coimbatore_water_bodies.geojson (with watershed_id)
"""

import sys
import json
import logging
from pathlib import Path
import geopandas as gpd
from shapely.geometry import box, Polygon, MultiPolygon

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("generate_watersheds")

BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "datas" / "processed"
WATER_BODIES_FILE = PROCESSED_DIR / "coimbatore_water_bodies.geojson"
WATERSHEDS_OUTPUT_FILE = PROCESSED_DIR / "coimbatore_watersheds.geojson"

# Major Watershed Sub-Catchments in Coimbatore District
WATERSHED_DEFINITIONS = [
    {
        "id": "WS_NOYYAL_01",
        "name": "Noyyal River Basin",
        "district": "Coimbatore",
        "river_basin": "Noyyal",
        "bbox": [76.85, 10.90, 77.25, 11.15]  # Central Coimbatore urban/semi-urban core
    },
    {
        "id": "WS_BHAVANI_02",
        "name": "Bhavani Upper Catchment",
        "district": "Coimbatore",
        "river_basin": "Bhavani",
        "bbox": [76.65, 11.15, 77.20, 11.40]  # Northern Mettupalayam & foothills
    },
    {
        "id": "WS_ALIYAR_03",
        "name": "Aliyar Sub-Watershed",
        "district": "Coimbatore",
        "river_basin": "Aliyar",
        "bbox": [76.80, 10.40, 77.30, 10.70]  # Southern Pollachi region
    },
    {
        "id": "WS_AMARAVATHI_04",
        "name": "Amaravathi Drainage Basin",
        "district": "Coimbatore",
        "river_basin": "Amaravathi",
        "bbox": [77.05, 10.22, 77.30, 10.50]  # South-Eastern Anaimalai catchment
    },
    {
        "id": "WS_SIRUVANI_05",
        "name": "Siruvani Catchment",
        "district": "Coimbatore",
        "river_basin": "Siruvani",
        "bbox": [76.65, 10.70, 76.90, 11.00]  # Western Ghats hill catchment
    }
]

def create_watershed_polygons() -> gpd.GeoDataFrame:
    """Constructs GeoDataFrame of watershed catchment boundaries."""
    records = []
    for ws in WATERSHED_DEFINITIONS:
        poly = box(*ws["bbox"])
        records.append({
            "watershed_id": ws["id"],
            "name": ws["name"],
            "district": ws["district"],
            "river_basin": ws["river_basin"],
            "geometry": poly
        })
    gdf = gpd.GeoDataFrame(records, crs="EPSG:4326")
    
    # Calculate area in metric CRS (EPSG:32643)
    gdf_metric = gdf.to_crs(epsg=32643)
    gdf["area_sqkm"] = (gdf_metric.geometry.area / 1e6).round(2)
    return gdf

def link_water_bodies_to_watersheds(ws_gdf: gpd.GeoDataFrame):
    """Spatially links each water body to its enclosing watershed."""
    if not WATER_BODIES_FILE.exists():
        logger.error(f"Water bodies GeoJSON missing at {WATER_BODIES_FILE}")
        return

    logger.info(f"Loading water bodies from {WATER_BODIES_FILE}...")
    wb_gdf = gpd.read_file(WATER_BODIES_FILE)

    logger.info("Performing spatial join to assign watershed_id to water bodies...")
    # Spatial join using centroid to assign a unique watershed
    wb_metric = wb_gdf.to_crs(epsg=32643)
    wb_centroids = wb_metric.copy()
    wb_centroids["geometry"] = wb_centroids.geometry.centroid
    ws_metric = ws_gdf.to_crs(epsg=32643).rename(columns={"name": "ws_name"})

    joined = gpd.sjoin(wb_centroids, ws_metric[["watershed_id", "ws_name", "geometry"]], how="left", predicate="intersects")
    # Deduplicate in case a point touches border
    joined = joined[~joined.index.duplicated(keep="first")]

    wb_gdf["watershed_id"] = joined["watershed_id"].fillna("WS_NOYYAL_01")
    wb_gdf["watershed_name"] = joined["ws_name"].fillna("Noyyal River Basin")

    logger.info("Saving updated water bodies GeoJSON with watershed_id tags...")
    wb_gdf.to_file(WATER_BODIES_FILE, driver="GeoJSON")
    logger.info(f"Updated {len(wb_gdf)} water bodies with watershed linkage.")

def main():
    logger.info("=== Starting Watershed Boundary Generation ===")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    ws_gdf = create_watershed_polygons()
    ws_gdf.to_file(WATERSHEDS_OUTPUT_FILE, driver="GeoJSON")
    logger.info(f"Exported {len(ws_gdf)} watershed boundaries to {WATERSHEDS_OUTPUT_FILE}")

    link_water_bodies_to_watersheds(ws_gdf)
    logger.info("=== Watershed Generation Complete ===")

if __name__ == "__main__":
    main()
