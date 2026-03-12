from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional, Dict
import pandas as pd
import io
from datetime import datetime
from app.db.session import get_db, SessionLocal
from app.models.schemas import Asset, Spec, SystemLog
from app.schemas.asset import AssetResponse, AssetUpdate, AssetCreate, AssetBatchDelete, AssetBatchSoftDelete
from app.core.engine import engine

router = APIRouter(prefix="/assets", tags=["Assets"])

def normalize_asset_id(asset_id: str) -> str:
    """Removes all whitespace and converts to uppercase for consistent ID checking."""
    if not isinstance(asset_id, str):
        return ""
    return "".join(asset_id.split()).upper()

@router.get("/", response_model=List[AssetResponse])
def get_assets(search: Optional[str] = None, archived: bool = False, db: Session = Depends(get_db)):
    query = db.query(Asset)
    if archived:
        query = query.filter(Asset.is_active == False)
    else:
        query = query.filter(Asset.is_active == True)
    
    if search:
        health_statuses = ["Healthy", "Warning", "Critical", "Unscored"]
        if search in health_statuses:
            cond1 = Asset.override_score == search
            cond2 = and_(Asset.override_score == None, Asset.health_score == search)
            query = query.filter(or_(cond1, cond2))
        else:
            # Normalize search term for asset_id search
            search_term_normalized = f"%{normalize_asset_id(search)}%"
            query = query.filter(
                or_(
                    Asset.asset_id.ilike(search_term_normalized),
                    Asset.model_name.ilike(f"%{search}%")
                )
            )

    assets = query.all()
    for a in assets:
        a.current_age = engine.calculate_current_age(a.initial_age, a.created_at)
        if not a.device_type and a.spec:
            a.device_type = a.spec.device_type
    return assets

@router.get("/export", response_class=StreamingResponse)
def export_assets(db: Session = Depends(get_db)):
    assets = db.query(Asset).filter(Asset.is_active == True).all()
    data = []
    for a in assets:
        current_age = engine.calculate_current_age(a.initial_age, a.created_at)
        device_type = a.device_type
        if not device_type and a.spec:
            device_type = a.spec.device_type
        data.append({
            "Asset ID": a.asset_id, "Model Name": a.model_name, "Device Type": device_type,
            "Initial Age (Months)": a.initial_age, "Current Age (Months)": current_age,
            "Current Temp (C)": a.current_temp, "Current Usage (Hrs/Week)": a.current_usage,
            "Maintenance Score": a.maint_score, "Repairs": a.repairs,
            "Health Score": a.override_score if a.override_score else a.health_score,
            "Override Score": a.override_score, "Override Reason": a.override_reason,
            "Is Generic": a.is_generic,
            "Last Updated": a.last_updated.strftime("%Y-%m-%d %H:%M:%S") if a.last_updated else None
        })
    df = pd.DataFrame(data)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=assets_export.csv"
    return response

@router.post("/", response_model=AssetResponse)
def create_asset(asset_in: AssetCreate, db: Session = Depends(get_db)):
    normalized_id = normalize_asset_id(asset_in.asset_id)
    if not normalized_id:
        raise HTTPException(status_code=400, detail="Asset ID cannot be empty.")

    existing_asset = db.query(Asset).filter(func.upper(Asset.asset_id) == normalized_id).first()
    if existing_asset:
        if not existing_asset.is_active:
             raise HTTPException(status_code=400, detail="Asset ID exists in archive. Restore it instead.")
        raise HTTPException(status_code=400, detail="Asset ID already exists")

    is_generic = False
    spec = db.query(Spec).filter(Spec.model_name == asset_in.model_name).first()
    if not spec:
        if asset_in.device_type == "laptop":
            spec = db.query(Spec).filter(Spec.model_name == "Generic Laptop").first()
        elif asset_in.device_type == "desktop":
            spec = db.query(Spec).filter(Spec.model_name == "Generic Desktop").first()
        if spec:
            is_generic = True

    new_asset = Asset(
        asset_id=normalized_id,
        model_name=asset_in.model_name, device_type=asset_in.device_type,
        initial_age=asset_in.initial_age, current_temp=asset_in.current_temp,
        current_usage=asset_in.current_usage, maint_score=asset_in.maint_score,
        repairs=asset_in.repairs, is_generic=is_generic,
        last_updated=asset_in.last_updated or datetime.utcnow()
    )
    db.add(new_asset)
    log = SystemLog(action_type="CREATE", entity_type="ASSET", entity_id=new_asset.asset_id, details=f"Manual creation. Model: {new_asset.model_name}")
    db.add(log)
    try:
        db.commit()
        db.refresh(new_asset)
        new_asset.current_age = engine.calculate_current_age(new_asset.initial_age, new_asset.created_at)
        return new_asset
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

@router.post("/bulk-upload-preview")
async def bulk_upload_preview(data: List[dict], db: Session = Depends(get_db)):
    new_count = 0
    update_count = 0
    for row in data:
        asset_id = normalize_asset_id(row.get('asset_id'))
        if not asset_id:
            continue
        existing_asset = db.query(Asset).filter(func.upper(Asset.asset_id) == asset_id).first()
        if existing_asset:
            update_count += 1
        else:
            new_count += 1
    return {"new_assets": new_count, "updated_assets": update_count}

@router.post("/bulk-upload")
async def bulk_upload_json(data: List[dict], db: Session = Depends(get_db)):
    logs = []
    processed_count = 0
    for row in data:
        asset_id = normalize_asset_id(row.get('asset_id'))
        if not asset_id:
            logs.append({"status": "skipped", "message": "Row missing asset_id"})
            continue

        existing_asset = db.query(Asset).filter(func.upper(Asset.asset_id) == asset_id).first()
        if existing_asset:
            # Update logic...
            existing_asset.current_temp = row.get('current_temp', existing_asset.current_temp)
            existing_asset.current_usage = row.get('current_usage', existing_asset.current_usage)
            existing_asset.maint_score = row.get('maint_score', existing_asset.maint_score)
            existing_asset.repairs = row.get('repairs', existing_asset.repairs)
            existing_asset.last_updated = datetime.utcnow()
            logs.append({"status": "updated", "message": f"Asset {asset_id} updated."})
        else:
            # Create new asset
            new_asset = Asset(
                asset_id=asset_id,
                model_name=row.get('model_name', 'Unknown Model'),
                device_type=row.get('device_type'), 
                initial_age=row.get('initial_age', 0),
                current_temp=row.get('current_temp', 0.0),
                current_usage=row.get('current_usage', 0.0),
                maint_score=row.get('maint_score', 5),
                repairs=row.get('repairs', 0),
                last_updated=datetime.utcnow()
            )
            db.add(new_asset)
            logs.append({"status": "created", "message": f"Asset {asset_id} onboarded."})
        processed_count += 1

    if processed_count > 0:
        log = SystemLog(action_type="UPLOAD", entity_type="ASSET", entity_id="BATCH", details=f"Bulk upload processed {processed_count} records.")
        db.add(log)
    try:
        db.commit()
        return {"processed": processed_count, "logs": logs}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

# All path-based endpoints now use normalized IDs for lookup
@router.post("/{asset_id}/diagnose")
def run_single_diagnostic(asset_id: str, db: Session = Depends(get_db)):
    normalized_id = normalize_asset_id(asset_id)
    asset = db.query(Asset).filter(func.upper(Asset.asset_id) == normalized_id).first()
    if not asset or not asset.is_active:
        raise HTTPException(status_code=404, detail="Asset not found")
    # ... (rest of the function is the same)
    spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()
    if not spec:
        if asset.device_type == "laptop": spec = db.query(Spec).filter(Spec.model_name == "Generic Laptop").first()
        elif asset.device_type == "desktop": spec = db.query(Spec).filter(Spec.model_name == "Generic Desktop").first()
        if spec: asset.is_generic = True
        else: raise HTTPException(status_code=400, detail="Manufacturer specs missing for this model.")
    features = engine.prepare_features(asset, spec)
    label, cid = engine.predict_health(features)
    asset.health_score = label
    asset.cluster_id = cid
    db.commit()
    return {"asset_id": asset_id, "score": label, "cluster": cid}

@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: str, obj_in: AssetUpdate, db: Session = Depends(get_db)):
    normalized_id = normalize_asset_id(asset_id)
    asset = db.query(Asset).filter(func.upper(Asset.asset_id) == normalized_id).first()
    if not asset or not asset.is_active:
        raise HTTPException(status_code=404, detail="Asset not found")
    # ... (rest of the function is the same)
    update_data = obj_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(asset, field, value)
    log = SystemLog(action_type="UPDATE", entity_type="ASSET", entity_id=asset_id, details=f"Asset updated. Override: {obj_in.override_score}" if obj_in.override_score else "Asset data updated.")
    db.add(log)
    db.commit()
    db.refresh(asset)
    asset.current_age = engine.calculate_current_age(asset.initial_age, asset.created_at)
    return asset

@router.delete("/{asset_id}")
def delete_asset(asset_id: str, reason: str = "Manual Deletion", db: Session = Depends(get_db)):
    normalized_id = normalize_asset_id(asset_id)
    asset = db.query(Asset).filter(func.upper(Asset.asset_id) == normalized_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    # ... (rest of the function is the same)
    asset.is_active = False
    asset.deletion_reason = reason
    log = SystemLog(action_type="ARCHIVE", entity_type="ASSET", entity_id=asset_id, details=f"Asset archived. Reason: {reason}")
    db.add(log)
    db.commit()
    return {"message": f"Asset {asset_id} archived."}

@router.post("/batch-delete")
def delete_assets_batch(payload: AssetBatchSoftDelete, db: Session = Depends(get_db)):
    normalized_ids = [normalize_asset_id(aid) for aid in payload.asset_ids]
    assets = db.query(Asset).filter(func.upper(Asset.asset_id).in_(normalized_ids)).all()
    if not assets:
        raise HTTPException(status_code=404, detail="No matching assets found.")
    # ... (rest of the function is the same)
    archived_count = 0
    for asset in assets:
        if asset.is_active:
            asset.is_active = False
            asset.deletion_reason = payload.reason
            archived_count += 1
    log = SystemLog(action_type="ARCHIVE", entity_type="ASSET", entity_id="BATCH", details=f"Batch archive: {archived_count} assets hidden. Reason: {payload.reason}")
    db.add(log)
    db.commit()
    return {"message": f"{archived_count} assets archived."}

@router.post("/{asset_id}/restore")
def restore_asset(asset_id: str, db: Session = Depends(get_db)):
    normalized_id = normalize_asset_id(asset_id)
    asset = db.query(Asset).filter(func.upper(Asset.asset_id) == normalized_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    # ... (rest of the function is the same)
    if asset.is_active:
        return {"message": "Asset is already active."}
    asset.is_active = True
    asset.deletion_reason = None
    log = SystemLog(action_type="RESTORE", entity_type="ASSET", entity_id=asset_id, details="Asset restored from archive.")
    db.add(log)
    db.commit()
    return {"message": f"Asset {asset_id} restored."}

@router.post("/bulk-diagnose")
async def trigger_bulk_diagnostic(background_tasks: BackgroundTasks):
    """Triggers fleet-wide scoring in the background."""
    def run_logic():
        db = SessionLocal()
        try:
            # Only diagnose active assets
            assets = db.query(Asset).filter(Asset.is_active == True).all()
            for asset in assets:
                spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()
                if not spec:
                    # Fallback logic
                    if asset.device_type == "laptop":
                        spec = db.query(Spec).filter(Spec.model_name == "Generic Laptop").first()
                    elif asset.device_type == "desktop":
                        spec = db.query(Spec).filter(Spec.model_name == "Generic Desktop").first()
                    
                    if spec:
                        asset.is_generic = True
                    else:
                        continue # Skip if no spec found

                features = engine.prepare_features(asset, spec)
                label, cid = engine.predict_health(features)
                asset.health_score = label
                asset.cluster_id = cid
            db.commit()
        finally:
            db.close()

    background_tasks.add_task(run_logic)
    return {"message": "Bulk diagnostic started."}