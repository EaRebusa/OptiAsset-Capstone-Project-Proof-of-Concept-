from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.schemas import Asset, Spec
from app.schemas.asset import AssetResponse, AssetUpdate
from app.core.engine import engine

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("/", response_model=List[AssetResponse])
def get_assets(db: Session = Depends(get_db)):
    assets = db.query(Asset).all()
    # Apply auto-aging and return
    for a in assets:
        a.current_age = engine.calculate_current_age(a.initial_age, a.created_at)
    return assets

@router.post("/{asset_id}/diagnose")
def run_diagnostic(asset_id: str, db: Session = Depends(get_db)):
    """
    Triggers the ML Engine for a specific asset.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()
    if not spec:
        raise HTTPException(status_code=400, detail="Manufacturer specs missing for this model")

    # 1. Engineer features
    features = engine.prepare_features(asset, spec)

    # 2. Predict
    label, cid = engine.predict_health(features)

    # 3. Update DB
    asset.health_score = label
    asset.cluster_id = cid
    db.commit()

    return {"asset_id": asset_id, "score": label, "cluster": cid}

@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: str, obj_in: AssetUpdate, db: Session = Depends(get_db)):
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