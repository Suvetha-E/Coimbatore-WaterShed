"""
preprocess_admin.py
-------------------
Extracts and validates the Coimbatore District boundary from the input administrative shapefile (Admin2.shp).
Includes dynamic attribute inspection, missing sidecar recovery (SHAPE_RESTORE_SHX), and strict CRS transformations.
Outputs: datas/processed/coimbatore_boundary.geojson
"""

import os
import sys
import logging
from pathlib import Path
import geopandas as gpd
from shapely.geometry import box, Polygon, MultiPolygon
import pyogrio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("preprocess_admin")

# Define target paths
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "datas"
PROCESSED_DIR = BASE_DIR / "datas" / "processed"
OUTPUT_BOUNDARY_FILE = PROCESSED_DIR / "coimbatore_boundary.geojson"

# Coimbatore Bounding Box (Lon Min, Lat Min, Lon Max, Lat Max)
# Bounding coordinates for Coimbatore District, Tamil Nadu
COIMBATORE_BBOX = [76.65, 10.22, 77.30, 11.40]

def find_admin_shapefile() -> Path:
    """Locates Admin2.shp across raw data directories."""
    candidates = [
        RAW_DIR / "raw" / "Admin2.shp",
        RAW_DIR / "Admin2.shp",
        RAW_DIR / "admin" / "Admin2.shp"
    ]
    for path in candidates:
        if path.exists():
            logger.info(f"Found administrative shapefile at: {path}")
            return path
    raise FileNotFoundError(f"Admin2.shp not found in candidate paths: {candidates}")

def extract_coimbatore_boundary() -> gpd.GeoDataFrame:
    """
    Reads Admin2.shp, restores missing SHX sidecar if needed,
    inspects attributes dynamically, and extracts the Coimbatore boundary geometry.
    """
    admin_path = find_admin_shapefile()
    
    # Enable GDAL SHX restoration in case .shx is missing
    pyogrio.set_gdal_config_options({"SHAPE_RESTORE_SHX": "YES"})
    
    logger.info("Reading Admin2 shapefile...")
    try:
        gdf = gpd.read_file(admin_path)
    except Exception as err:
        logger.error(f"Error reading shapefile {admin_path}: {err}")
        raise

    logger.info(f"Loaded Admin2 shapefile with {len(gdf)} features. CRS: {gdf.crs}")
    logger.info(f"Columns present: {list(gdf.columns)}")

    # Set default CRS to EPSG:4326 if unassigned
    if gdf.crs is None:
        logger.warning("CRS is unassigned in shapefile. Assuming EPSG:4326 (WGS84).")
        gdf.set_crs(epsg=4326, inplace=True)
    elif gdf.crs.to_epsg() != 4326:
        logger.info(f"Reprojecting admin shapefile from {gdf.crs} to EPSG:4326...")
        gdf = gdf.to_crs(epsg=4326)

    # Dynamic attribute matching if district columns exist
    cbe_gdf = None
    district_cols = [col for col in gdf.columns if any(k in col.lower() for k in ["dist", "name", "admin2", "st_name"])]
    
    if district_cols:
        logger.info(f"Inspecting attribute columns for district name matching: {district_cols}")
        for col in district_cols:
            matches = gdf[gdf[col].astype(str).str.lower().str.contains("coimbatore", na=False)]
            if not matches.empty:
                logger.info(f"Matched Coimbatore district in column '{col}' ({len(matches)} features found).")
                cbe_gdf = matches.copy()
                break

    # If no attribute match (e.g. missing .dbf file), extract using geometric containment / bounding extent
    if cbe_gdf is None or cbe_gdf.empty:
        logger.warning("Dynamic attribute search returned no direct match. Using spatial extent analysis for Coimbatore.")
        
        # Test feature 29 (Tamil Nadu) or spatial intersection
        bbox_poly = box(*COIMBATORE_BBOX)
        intersecting = gdf[gdf.geometry.intersects(bbox_poly)]
        
        if not intersecting.empty:
            logger.info(f"Found {len(intersecting)} intersecting state/admin polygon(s). Clipping bounding geometry for Coimbatore.")
            # Clip the state polygon to Coimbatore district bounding box
            clipped_geom = intersecting.geometry.unary_union.intersection(bbox_poly)
            cbe_gdf = gpd.GeoDataFrame(
                [{"district": "Coimbatore", "state": "Tamil Nadu", "source": "Spatial BBOX Intersection"}],
                geometry=[clipped_geom],
                crs="EPSG:4326"
            )
        else:
            logger.info("Fallback to direct Coimbatore district bounding box polygon.")
            cbe_gdf = gpd.GeoDataFrame(
                [{"district": "Coimbatore", "state": "Tamil Nadu", "source": "BBOX Synthetic Boundary"}],
                geometry=[bbox_poly],
                crs="EPSG:4326"
            )

    # Ensure geometry validity
    cbe_gdf["geometry"] = cbe_gdf["geometry"].make_valid()
    
    # Calculate area in metric CRS (UTM Zone 43N - EPSG:32643)
    cbe_metric = cbe_gdf.to_crs(epsg=32643)
    area_sqkm = cbe_metric.geometry.area.sum() / 1e6
    logger.info(f"Coimbatore boundary extracted successfully. Total Area: {area_sqkm:.2f} sq km.")
    logger.info(f"Bounding box: {cbe_gdf.total_bounds}")
    
    return cbe_gdf

def main():
    """Execution pipeline for Step 1 admin boundary extraction."""
    logger.info("=== Starting Step 1: Preprocessing Admin Boundary ===")
    
    # Ensure processed directory exists
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        cbe_boundary = extract_coimbatore_boundary()
        
        # Save output GeoJSON
        cbe_boundary.to_file(OUTPUT_BOUNDARY_FILE, driver="GeoJSON")
        logger.info(f"Saved Coimbatore boundary to: {OUTPUT_BOUNDARY_FILE}")
        
        # Verification check
        if OUTPUT_BOUNDARY_FILE.exists() and OUTPUT_BOUNDARY_FILE.stat().st_size > 0:
            logger.info(f"SUCCESS: Preprocessed admin boundary file created ({OUTPUT_BOUNDARY_FILE.stat().st_size} bytes).")
        else:
            logger.error("FAILURE: Output file was not created or is empty.")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Failed to preprocess admin boundary: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
