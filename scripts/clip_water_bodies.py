"""
clip_water_bodies.py
--------------------
Reads Tamil Nadu water bodies shapefile (wb_sac_tn.shp), reprojects to UTM Zone 43N (EPSG:32643) for metric area calculation,
and clips strictly to the Coimbatore boundary extracted in Step 1.

Outputs: datas/processed/coimbatore_water_bodies.geojson
"""

import sys
import logging
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("clip_water_bodies")

# Define target paths
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "datas"
PROCESSED_DIR = BASE_DIR / "datas" / "processed"
BOUNDARY_FILE = PROCESSED_DIR / "coimbatore_boundary.geojson"
OUTPUT_WATER_BODIES_FILE = PROCESSED_DIR / "coimbatore_water_bodies.geojson"

METRIC_CRS = "EPSG:32643"  # UTM Zone 43N for Coimbatore, Tamil Nadu
WGS84_CRS = "EPSG:4326"

def find_water_bodies_shapefile() -> Path:
    """Locates wb_sac_tn.shp across potential raw data directories."""
    candidates = [
        RAW_DIR / "wb_tn_shp" / "wb_sac_tn.shp",
        RAW_DIR / "raw" / "wb_sac_tn.shp",
        RAW_DIR / "wb_sac_tn.shp"
    ]
    for path in candidates:
        if path.exists():
            logger.info(f"Found TN water bodies shapefile at: {path}")
            return path
    raise FileNotFoundError(f"wb_sac_tn.shp not found in candidate paths: {candidates}")

def process_and_clip_water_bodies() -> gpd.GeoDataFrame:
    """
    Reads TN water bodies, reprojects to metric CRS (UTM 43N), clips to Coimbatore boundary,
    calculates precise metric areas, cleans geometries, and returns WGS84 GeoDataFrame.
    """
    if not BOUNDARY_FILE.exists():
        raise FileNotFoundError(f"Coimbatore boundary file missing at {BOUNDARY_FILE}. Run preprocess_admin.py first.")

    # Load Coimbatore district boundary
    logger.info(f"Loading Coimbatore district boundary from {BOUNDARY_FILE}...")
    boundary_gdf = gpd.read_file(BOUNDARY_FILE)
    if boundary_gdf.crs is None or boundary_gdf.crs.to_epsg() != 4326:
        boundary_gdf = boundary_gdf.to_crs(WGS84_CRS)

    # Load TN Water Bodies shapefile
    wb_path = find_water_bodies_shapefile()
    logger.info(f"Reading raw TN water bodies shapefile from {wb_path}...")
    raw_wb = gpd.read_file(wb_path)
    total_raw_count = len(raw_wb)
    logger.info(f"Loaded {total_raw_count} total water body features across Tamil Nadu. Native CRS: {raw_wb.crs}")

    # Ensure validity of input geometries
    raw_wb["geometry"] = raw_wb["geometry"].make_valid()

    # Fast spatial filtering in WGS84 before metric reprojecting
    logger.info("Performing initial spatial bounding filter for Coimbatore region...")
    boundary_wgs = boundary_gdf.to_crs(WGS84_CRS)
    bounds = boundary_wgs.total_bounds  # [minx, miny, maxx, maxy]
    
    # Reproject raw_wb to WGS84 for spatial bounding box filtering if needed
    if raw_wb.crs.to_epsg() != 4326:
        raw_wb_wgs = raw_wb.to_crs(WGS84_CRS)
    else:
        raw_wb_wgs = raw_wb

    # Filter features intersecting bounding box
    bbox_filtered = raw_wb_wgs.cx[bounds[0]:bounds[2], bounds[1]:bounds[3]].copy()
    logger.info(f"Bounding box spatial filter narrowed down features to {len(bbox_filtered)} candidate water bodies.")

    # Reproject both boundary and candidate water bodies to metric CRS (UTM 43N - EPSG:32643)
    logger.info(f"Reprojecting datasets to metric CRS: {METRIC_CRS} (UTM Zone 43N)...")
    boundary_metric = boundary_wgs.to_crs(METRIC_CRS)
    candidates_metric = bbox_filtered.to_crs(METRIC_CRS)

    # Perform strict polygon clipping
    logger.info("Clipping water body geometries strictly to Coimbatore district boundary polygon...")
    clipped_gdf = gpd.clip(candidates_metric, boundary_metric)
    initial_clipped_count = len(clipped_gdf)
    logger.info(f"Clipped dataset contains {initial_clipped_count} features.")

    # Clean invalid or zero-area geometries
    logger.info("Validating geometries and recalculating metric area attributes...")
    clipped_gdf["geometry"] = clipped_gdf["geometry"].make_valid()
    
    # Drop non-polygon or zero area geometries
    valid_mask = (
        ~clipped_gdf.geometry.is_empty &
        clipped_gdf.geometry.is_valid &
        (clipped_gdf.geometry.area > 10.0)  # Filter out tiny slivers (< 10 sq m)
    )
    removed_count = initial_clipped_count - valid_mask.sum()
    cleaned_gdf = clipped_gdf[valid_mask].copy()

    logger.info(f"Removed {removed_count} invalid slivers/empty geometries. Retained {len(cleaned_gdf)} features.")

    # Compute metric area attributes (EPSG:32643)
    cleaned_gdf["area_sqm"] = cleaned_gdf.geometry.area
    cleaned_gdf["area_ha_calc"] = cleaned_gdf["area_sqm"] / 10000.0

    # Ensure standardized attribute fields
    if "wb_id" not in cleaned_gdf.columns:
        if "id" in cleaned_gdf.columns:
            cleaned_gdf["wb_id"] = cleaned_gdf["id"].astype(str)
        else:
            cleaned_gdf["wb_id"] = [f"CBE_WB_{i+1:04d}" for i in range(len(cleaned_gdf))]

    # Set default values for missing attributes gracefully
    if "wetname" in cleaned_gdf.columns:
        cleaned_gdf["name"] = cleaned_gdf["wetname"].fillna("Unnamed Water Body")
    else:
        cleaned_gdf["name"] = "Unnamed Water Body"

    if "level_iii" in cleaned_gdf.columns:
        cleaned_gdf["category"] = cleaned_gdf["level_iii"].fillna("Water Body / Reservoir")
    else:
        cleaned_gdf["category"] = "Water Body"

    # Standardize baseline area and temporal change attributes for downstream analysis engine
    cleaned_gdf["baseline_area_ha"] = cleaned_gdf["area_ha_calc"].round(4)
    # Default current area set to baseline (will be evaluated against temporal satellite/observation records in backend)
    cleaned_gdf["current_area_ha"] = cleaned_gdf["baseline_area_ha"]
    cleaned_gdf["area_change_pct"] = 0.0
    cleaned_gdf["status"] = "STABLE"

    # Reproject back to WGS84 for GeoJSON / Leaflet web visualization
    logger.info(f"Reprojecting cleaned GeoDataFrame to {WGS84_CRS} (WGS84)...")
    final_gdf = cleaned_gdf.to_crs(WGS84_CRS)

    # Log summary statistics
    total_area_ha = cleaned_gdf["area_ha_calc"].sum()
    total_area_sqkm = total_area_ha / 100.0
    logger.info("=== Preprocessing Summary ===")
    logger.info(f"Raw Input Features (TN): {total_raw_count}")
    logger.info(f"Clipped Coimbatore Features: {len(final_gdf)}")
    logger.info(f"Removed Slivers / Errors: {removed_count}")
    logger.info(f"Total Surface Water Spread Area: {total_area_ha:.2f} ha ({total_area_sqkm:.2f} sq km)")
    logger.info(f"Min Water Body Area: {cleaned_gdf['area_ha_calc'].min():.4f} ha")
    logger.info(f"Max Water Body Area: {cleaned_gdf['area_ha_calc'].max():.4f} ha")

    return final_gdf

def main():
    """Execution wrapper for Step 1 water body clipping pipeline."""
    logger.info("=== Starting Step 1: Water Body Clipping Pipeline ===")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    try:
        cbe_water_bodies = process_and_clip_water_bodies()

        # Export to GeoJSON
        logger.info(f"Writing GeoJSON output to {OUTPUT_WATER_BODIES_FILE}...")
        cbe_water_bodies.to_file(OUTPUT_WATER_BODIES_FILE, driver="GeoJSON")
        logger.info(f"Saved {len(cbe_water_bodies)} water bodies to: {OUTPUT_WATER_BODIES_FILE}")

        # Verification check
        if OUTPUT_WATER_BODIES_FILE.exists() and OUTPUT_WATER_BODIES_FILE.stat().st_size > 0:
            file_size_mb = OUTPUT_WATER_BODIES_FILE.stat().st_size / (1024 * 1024)
            logger.info(f"SUCCESS: {OUTPUT_WATER_BODIES_FILE.name} created successfully ({file_size_mb:.2f} MB).")
        else:
            logger.error("FAILURE: Output GeoJSON was not created or is empty.")
            sys.exit(1)

    except Exception as e:
        logger.error(f"Error in clip_water_bodies pipeline: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
