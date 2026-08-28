# Geo-Spatial Visualization and Temporal Interpretation of Water Bodies & Watershed Conditions

**Smart India Hackathon (SIH) Prototype**  
**Study Area:** Coimbatore District, Tamil Nadu, India  
**Target Capabilities:** Remote Sensing Vector Processing, Metric Area Calculations (UTM Zone 43N), Non-Causal Spatial Association Rule Engine, Citizen Soil Moisture Telemetry, Officer Alert Dispatcher, and React + Leaflet Web GIS Dashboard.

---

## CRITICAL SCIENTIFIC RULE
> **Non-Causal Spatial Association Framework**: Spatial proximity alone (e.g., adjacent agricultural land or crop activity next to a shrinking water body) is strictly reported as a **"Spatial Association"** or **"Contextual Correlation"**, avoiding unverified causal claims (e.g. *"agriculture caused shrinkage"*). Causal inference requires multi-point hydrogeological modeling and ground stream-gauge telemetry.

---

## Repository Structure

```
coimbatore-watershed-monitor/
├── datas/
│   ├── raw/                      # Raw shapefiles (Admin2.shp, wb_sac_tn.shp)
│   ├── processed/                # Clipped & metric-calculated outputs
│   │   ├── coimbatore_boundary.geojson
│   │   └── coimbatore_water_bodies.geojson (4.01 MB - 929 features)
│   └── watershed_monitor.db     # SQLite + SpatiaLite Database
│
├── scripts/
│   ├── preprocess_admin.py       # Reads Admin2.shp, extracts Coimbatore boundary
│   ├── clip_water_bodies.py      # Reprojects to UTM 43N (EPSG:32643) & clips TN water bodies
│   └── db_init.py                # Initializes SQLite schema & seeds 929 water bodies
│
├── app/
│   ├── main.py                   # FastAPI main application & CORS setup
│   ├── config.py                 # Pydantic Settings & threshold configuration
│   │
│   ├── api/                      # REST API Endpoints
│   │   ├── water_bodies.py       # GET /api/water-bodies
│   │   ├── analysis.py           # GET /api/water-body/{id}/analyze
│   │   ├── feedback.py           # POST /api/feedback/soil-moisture
│   │   └── admin_officer.py      # POST /api/admin/assign-task, GET /api/officer/alerts
│   │
│   ├── analysis/                 # Rule Engine & Change Detection
│   │   ├── change_detection.py   # Area delta & percentage change
│   │   └── assessment.py         # Non-causal rule engine (EXPANDED, STABLE, REDUCED, CRITICAL)
│   │
│   ├── database/                 # SQLite / SpatiaLite Connection Manager
│   │   └── spatialite.py         # DB connection & CRUD functions
│   │
│   └── schemas/                  # Pydantic Request/Response Models
│       └── pydantic_models.py
│
├── frontend/                     # React 18 + Leaflet Web Application
│   ├── public/
│   ├── src/
│   │   ├── components/           # MapViewer, WaterBodyDrawer, CitizenFeedbackModal, AdminTaskModal, OfficerAlertPanel
│   │   ├── App.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── tests/                        # Pytest Test Suite
│   └── test_backend.py
│
├── requirements.txt              # Python GIS & Backend dependencies
├── .env.example                  # Environment defaults
└── README.md
```

---

## Step-by-Step Setup & Running Guide

### Step 1: Preprocess GIS Data & Clip Water Bodies
```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Extract Coimbatore district boundary from Admin2 shapefile
python scripts/preprocess_admin.py

# 3. Reproject TN water bodies to UTM 43N (EPSG:32643) & clip to Coimbatore
python scripts/clip_water_bodies.py
```

### Step 2: Initialize Database Schema & Seed Data
```bash
# Initializes datas/watershed_monitor.db with 929 water bodies, temporal records, and active alerts
python scripts/db_init.py
```

### Step 3: Run FastAPI Backend Server
```bash
# Start backend API server on http://localhost:8000
uvicorn app.main:app --reload --port 8000
```
- Interactive API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### Step 4: Run React + Leaflet Frontend Application
```bash
# Navigate to frontend folder
cd frontend

# Install node dependencies
npm install

# Start Vite development server on http://localhost:3000
npm run dev
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | System health check and dataset summary |
| `GET` | `/api/water-bodies` | Returns GeoJSON FeatureCollection of 929 Coimbatore water bodies |
| `GET` | `/api/water-body/{id}/analyze` | Detailed temporal analysis, contextual indicator profile, citizen feedback & photos |
| `POST` | `/api/feedback/soil-moisture` | Submits citizen ground soil-moisture telemetry (`DRY`, `OPTIMAL`, `WATERLOGGED`) |
| `POST` | `/api/admin/assign-task` | Dispatches ground physical verification tasks to field officers |
| `GET` | `/api/officer/alerts` | Fetches active critical alerts (water spread reduction $\le -30\%$) and pending tasks |

---

## Running Automated Test Suite

```bash
python -m pytest tests/test_backend.py
```
*Validates database CRUD, rule engine assessment logic, and all FastAPI endpoints.*
