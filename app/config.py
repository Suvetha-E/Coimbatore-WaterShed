"""
app/config.py
-------------
Application configuration and settings using Pydantic BaseSettings.
"""

from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Coimbatore Watershed & Water Body Monitor"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Path settings
    DATABASE_PATH: Path = BASE_DIR / "datas" / "watershed_monitor.db"
    GEOJSON_PATH: Path = BASE_DIR / "datas" / "processed" / "coimbatore_water_bodies.geojson"
    BOUNDARY_GEOJSON_PATH: Path = BASE_DIR / "datas" / "processed" / "coimbatore_boundary.geojson"
    
    # GIS & Scientific Threshold Settings
    ALERT_THRESHOLD_PCT: float = -30.0  # Alert triggered if water spread reduction <= -30%
    STABLE_THRESHOLD_PCT: float = 10.0  # Stable within -10% to +10%
    REDUCTION_THRESHOLD_PCT: float = -10.0 # Reduction flagged if < -10%
    
    METRIC_CRS: str = "EPSG:32643"  # UTM Zone 43N for Coimbatore, Tamil Nadu
    WGS84_CRS: str = "EPSG:4326"
    
    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()
