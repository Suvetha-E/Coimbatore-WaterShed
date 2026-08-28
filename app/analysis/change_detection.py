"""
app/analysis/change_detection.py
--------------------------------
Computes area differences, percentage spread changes, cloud cover confidence scores,
and seasonality matching flags for water bodies.
"""

from typing import Dict, Any, List

def check_seasonality_match(date1_str: str, date2_str: str) -> Dict[str, Any]:
    """
    Checks whether two observation dates belong to similar seasonal windows.
    Returns boolean match flag and scientific warning message if unmatched.
    """
    try:
        m1 = int(date1_str.split("-")[1])
        m2 = int(date2_str.split("-")[1])
        
        # Simple season binning for Tamil Nadu:
        # Pre-Monsoon (Jan-May: 1-5), Monsoon (Jun-Sep: 6-9), Post-Monsoon (Oct-Dec: 10-12)
        def get_season(month):
            if 1 <= month <= 5:
                return "PRE_MONSOON_DRY"
            elif 6 <= month <= 9:
                return "SOUTHWEST_MONSOON"
            else:
                return "NORTHEAST_MONSOON"

        s1 = get_season(m1)
        s2 = get_season(m2)
        
        is_matched = (s1 == s2)
        warning = None if is_matched else (
            f"Seasonally unmatched comparison ({s1} vs {s2}) — "
            "apparent water spread reduction may be influenced by natural seasonal dry-down."
        )
        
        return {
            "is_matched": is_matched,
            "season_1": s1,
            "season_2": s2,
            "warning": warning
        }
    except Exception:
        return {"is_matched": True, "warning": None}

def calculate_area_change(
    baseline_ha: float,
    current_ha: float,
    baseline_date: str = "2022-03-15",
    current_date: str = "2026-03-15"
) -> Dict[str, Any]:
    """
    Computes absolute area delta (ha), percentage change, confidence, and seasonality status.
    """
    if baseline_ha <= 0.0:
        return {
            "baseline_area_ha": baseline_ha,
            "current_area_ha": current_ha,
            "area_delta_ha": 0.0,
            "area_change_pct": 0.0,
            "status": "INSUFFICIENT_DATA",
            "seasonality": check_seasonality_match(baseline_date, current_date)
        }

    delta_ha = round(current_ha - baseline_ha, 4)
    pct_change = round(((current_ha - baseline_ha) / baseline_ha) * 100.0, 2)
    seasonality = check_seasonality_match(baseline_date, current_date)

    if pct_change > 10.0:
        status = "EXPANDED"
    elif -10.0 <= pct_change <= 10.0:
        status = "NO_SIGNIFICANT_CHANGE"
    elif -30.0 < pct_change < -10.0:
        status = "MODERATE_REDUCTION"
    else:
        status = "SIGNIFICANT_REDUCTION"

    return {
        "baseline_area_ha": baseline_ha,
        "current_area_ha": current_ha,
        "area_delta_ha": delta_ha,
        "area_change_pct": pct_change,
        "status": status,
        "seasonality": seasonality
    }
