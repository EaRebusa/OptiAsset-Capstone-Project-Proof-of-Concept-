from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.schemas import Asset, Spec
import pandas as pd
import io

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/monthly-summary", response_class=StreamingResponse)
def get_monthly_summary(db: Session = Depends(get_db)):
    """
    Generates a monthly summary report CSV.
    This includes Health Distribution, Average Age per Device, and Total Repairs.
    """
    
    # 1. Asset Health Distribution
    health_counts = db.query(
        Asset.health_score, func.count(Asset.id)
    ).filter(Asset.is_active == True).group_by(Asset.health_score).all()
    
    health_map = {h[0]: h[1] for h in health_counts}
    
    # 2. Average Age per Device Type
    avg_age = db.query(
        Asset.device_type, func.avg(Asset.initial_age) # Simplified age
    ).filter(Asset.is_active == True).group_by(Asset.device_type).all()
    
    # 3. Total Repairs
    total_repairs = db.query(func.sum(Asset.repairs)).filter(Asset.is_active == True).scalar() or 0
    
    # Construct Report Data
    report_data = []

    # Health Section
    for status in ["Healthy", "Warning", "Critical", "Unscored"]:
        if status in health_map:
            report_data.append({
                "Category": "Health Distribution",
                "Metric": status,
                "Value": health_map[status]
            })

    # Age Section
    for dtype, val in avg_age:
        if dtype:
            report_data.append({
                "Category": "Average Age (Months)",
                "Metric": dtype,
                "Value": round(val, 1)
            })

    # Repairs Section
    report_data.append({
        "Category": "Maintenance",
        "Metric": "Total Repairs Logged",
        "Value": total_repairs
    })
    
    df = pd.DataFrame(report_data)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = StreamingResponse(iter([stream.getvalue()]),
                                 media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=monthly_report_summary.csv"
    return response

@router.get("/charts/health-distribution")
def get_health_distribution_data(db: Session = Depends(get_db)):
    """
    Returns JSON data for the health distribution chart.
    """
    health_counts = db.query(
        Asset.health_score, func.count(Asset.id)
    ).filter(Asset.is_active == True).group_by(Asset.health_score).all()
    
    data_map = {h[0]: h[1] for h in health_counts}
    
    statuses = ["Healthy", "Warning", "Critical", "Unscored"]
    
    data = []
    for s in statuses:
        data.append({"name": s, "value": data_map.get(s, 0)})
        
    return data

@router.get("/charts/age-distribution")
def get_age_distribution_data(db: Session = Depends(get_db)):
    """
    Returns JSON data for average age per device type.
    """
    # 1. Fetch assets with their device types
    assets = db.query(Asset).filter(Asset.is_active == True).all()

    # 2. Process to fill missing device_type using Specs if needed
    data_points = {} # {device_type: [ages]}
    
    for asset in assets:
        dtype = asset.device_type
        # Fallback to Spec if direct device_type is missing
        if not dtype and asset.model_name:
             # Manual lookup if not populated
             try:
                 if asset.spec:
                     dtype = asset.spec.device_type
             except:
                 pass
                 
             if not dtype:
                 spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()
                 if spec:
                     dtype = spec.device_type
        
        if dtype:
            if dtype not in data_points:
                data_points[dtype] = []
            data_points[dtype].append(asset.initial_age)

    # 3. Calculate Averages and format for JSON
    data = []
    if data_points:
        for dtype, ages in data_points.items():
            if ages:
                avg = sum(ages) / len(ages)
                data.append({"name": dtype, "value": round(avg, 1)})
    
    return data