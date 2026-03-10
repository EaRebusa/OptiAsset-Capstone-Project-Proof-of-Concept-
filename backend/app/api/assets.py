from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import pandas as pd
import io
from app.db.session import get_db, SessionLocal
from app.models.schemas import Asset, Spec
from app.schemas.asset import AssetResponse, AssetUpdate
from app.core.engine import engine

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("/", response_model=List[AssetResponse])
def get_assets(search: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Fetches all assets with live age calculation.
    Can be filtered by a search term, which can be a health status or a text search on asset ID/model name.
    """
    query = db.query(Asset)

    if search:
        health_statuses = ["Healthy", "Warning", "Critical", "Unscored"]
        # Check if the search term is a specific health status
        if search in health_statuses:
            # Filter by the effective health score. An asset's score is its override_score if it exists, otherwise its health_score.
            query = query.filter(
                or_(
                    Asset.override_score == search,
                    and_(
                        Asset.override_score == None,
                        Asset.health_score == search
                    )
                )
            )
        else:
            # If not a status, perform a text search on asset ID and model name
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Asset.asset_id.ilike(search_term),
                    Asset.model_name.ilike(search_term)
                )
            )

    assets = query.all()
    for a in assets:
        a.current_age = engine.calculate_current_age(a.initial_age, a.created_at)
    return assets

@router.post("/bulk-diagnose")
async def trigger_bulk_diagnostic(background_tasks: BackgroundTasks):
    """Triggers fleet-wide scoring in the background."""
    def run_logic():
        db = SessionLocal()
        try:
            assets = db.query(Asset).all()
            for asset in assets:
                spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()
                if spec:
                    features = engine.prepare_features(asset, spec)
                    label, cid = engine.predict_health(features)
                    asset.health_score = label
                    asset.cluster_id = cid
            db.commit()
        finally:
            db.close()

    background_tasks.add_task(run_logic)
    return {"message": "Bulk diagnostic started."}

@router.post("/{asset_id}/diagnose")
def run_single_diagnostic(asset_id: str, db: Session = Depends(get_db)):
    """
    Triggers ML logic for a specific asset.
    Required by App.jsx handleDiagnose function.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()
    if not spec:
        raise HTTPException(status_code=400, detail="Manufacturer specs missing")

    features = engine.prepare_features(asset, spec)
    label, cid = engine.predict_health(features)

    asset.health_score = label
    asset.cluster_id = cid
    db.commit()
    return {"asset_id": asset_id, "score": label, "cluster": cid}

@router.post("/upload")
async def upload_assets(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Ingests CSV for Living Inventory updates."""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="CSV only.")
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        count = 0
        for _, row in df.iterrows():
            asset = db.query(Asset).filter(Asset.asset_id == row['asset_id']).first()
            if asset:
                asset.current_temp = row['current_temp']
                asset.current_usage = row['current_usage']
                asset.maint_score = row.get('maint_score', asset.maint_score)
                asset.repairs = row.get('repairs', asset.repairs)
            else:
                db.add(Asset(
                    asset_id=row['asset_id'], model_name=row['model_name'],
                    initial_age=row.get('initial_age', 0), current_temp=row['current_temp'],
                    current_usage=row['current_usage'], maint_score=row.get('maint_score', 5),
                    repairs=row.get('repairs', 0)
                ))
            count += 1
        db.commit()
        return {"processed": count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: str, obj_in: AssetUpdate, db: Session = Depends(get_db)):
    """Handles Manager Overrides (Human-in-the-loop)."""
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = obj_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(asset, field, value)

    db.commit()
    db.refresh(asset)
    asset.current_age = engine.calculate_current_age(asset.initial_age, asset.created_at)
    return asset