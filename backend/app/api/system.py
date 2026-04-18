from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.schemas import Asset, SystemLog, SystemSettings, Spec
from app.schemas.system import SystemSettingsUpdate, SystemSettingsResponse, ClusterDataResponse
from app.core.engine import engine

router = APIRouter(prefix="/system", tags=["System Operations"])

@router.post("/retrain")
def retrain_ai_model(db: Session = Depends(get_db)):
    """
    Triggers a full retraining of the KMeans model using current active inventory data.
    This adapts the 'Critical' definition to the new fleet reality.
    """
    # 1. Fetch current data
    assets = db.query(Asset).filter(Asset.is_active == True).all()
    
    # 2. Trigger Engine Logic
    success, message = engine.retrain_model(assets)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # 3. Log the event
    log = SystemLog(
        action_type="SYSTEM",
        entity_type="AI_MODEL",
        entity_id="CORE",
        details=f"Model Retrained. {message}"
    )
    db.add(log)
    db.commit()
    
    return {"message": message, "status": "success"}

@router.get("/settings", response_model=SystemSettingsResponse)
def get_system_settings(db: Session = Depends(get_db)):
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.put("/settings", response_model=SystemSettingsResponse)
def update_system_settings(settings_in: SystemSettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        
    for field, value in settings_in.dict().items():
        setattr(settings, field, value)
        
    log = SystemLog(action_type="UPDATE", entity_type="SYSTEM", entity_id="SETTINGS", details="Financial risk parameters updated.")
    db.add(log)
    db.commit()
    db.refresh(settings)
    return settings

@router.get("/cluster-data", response_model=ClusterDataResponse)
def get_cluster_data_for_visualization(db: Session = Depends(get_db)):
    """
    Exports the feature vectors and cluster assignments for all active assets.
    This data is used to generate the PCA visualization plot for documentation.
    """
    # 1. Fetch all active assets that have been clustered
    assets = db.query(Asset).filter(
        Asset.is_active == True,
        Asset.cluster_id != None
    ).all()

    if not assets:
        raise HTTPException(status_code=404, detail="No clustered asset data found. Run a bulk diagnostic first.")

    # --- Performance Improvement: Avoid N+1 queries ---
    # 2. Get all unique model names from the assets
    asset_model_names = {asset.model_name for asset in assets}
    
    # 3. Fetch all required specs in a single query, including generics
    required_specs = db.query(Spec).filter(
        Spec.model_name.in_(list(asset_model_names) + ["Generic Laptop", "Generic Desktop"])
    ).all()
    
    # 4. Create a lookup map for fast access
    specs_map = {spec.model_name: spec for spec in required_specs}
    generic_laptop_spec = specs_map.get("Generic Laptop")
    generic_desktop_spec = specs_map.get("Generic Desktop")
    # --- End Improvement ---

    features_list = []
    labels_list = []

    # 5. Re-create the feature vectors and collect labels using the specs map
    for asset in assets:
        spec = specs_map.get(asset.model_name)
        if not spec:
            # Use the same fallback logic as the diagnostic endpoints
            if asset.device_type and "laptop" in asset.device_type.lower():
                spec = generic_laptop_spec
            elif asset.device_type and "desktop" in asset.device_type.lower():
                spec = generic_desktop_spec
            
            if not spec:
                # This asset cannot be processed, log it or skip it
                # For this script, skipping is fine.
                continue 

        features = engine.prepare_features(asset, spec)

        # Convert NumPy array to a standard Python list
        feat_list = features.tolist() if hasattr(features, 'tolist') else list(features)
        # ML engines often return 2D arrays for single samples (e.g., [[1.5, 2.5, ...]])
        # We need to extract the inner list to match our List[List[float]] schema
        if len(feat_list) == 1 and isinstance(feat_list[0], list):
            feat_list = feat_list[0]

        features_list.append(feat_list)
        labels_list.append(asset.cluster_id)

    if not features_list:
        # This can happen if all assets with cluster_id couldn't find a spec
        raise HTTPException(status_code=404, detail="Found clustered assets, but could not find matching specs to generate features.")

    return {"features": features_list, "labels": labels_list}