from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional, Dict
import pandas as pd
import io
from datetime import datetime
from app.db.session import get_db, SessionLocal
from app.models.schemas import Asset, Spec, SystemLog
from app.schemas.asset import AssetResponse, AssetUpdate, AssetCreate, AssetBatchDelete, AssetBatchSoftDelete
from app.core.engine import engine

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("/", response_model=List[AssetResponse])
def get_assets(search: Optional[str] = None, archived: bool = False, db: Session = Depends(get_db)):
    """
    Fetches assets. Defaults to active assets.
    Pass archived=True to fetch soft-deleted history.
    """
    query = db.query(Asset)
    
    # Filter by active status
    if archived:
        query = query.filter(Asset.is_active == False)
    else:
        query = query.filter(Asset.is_active == True)
    
    # Apply filtering logic
    if search:
        # Check if the search term matches any health status
        health_statuses = ["Healthy", "Warning", "Critical", "Unscored"]
        
        status_conditions = []
        if search in health_statuses:
            cond1 = Asset.override_score == search
            cond2 = and_(Asset.override_score == None, Asset.health_score == search)
            query = query.filter(or_(cond1, cond2))
        else:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Asset.asset_id.ilike(search_term),
                    Asset.model_name.ilike(search_term)
                )
            )

    assets = query.all()
    # Calculate current age dynamically for display
    for a in assets:
        a.current_age = engine.calculate_current_age(a.initial_age, a.created_at)
        # Ensure device_type is populated for frontend visual identity
        if not a.device_type and a.spec:
            a.device_type = a.spec.device_type

    return assets

@router.get("/export", response_class=StreamingResponse)
def export_assets(db: Session = Depends(get_db)):
    """
    Exports all active assets to a CSV file.
    """
    assets = db.query(Asset).filter(Asset.is_active == True).all()
    
    data = []
    for a in assets:
        current_age = engine.calculate_current_age(a.initial_age, a.created_at)
        device_type = a.device_type
        if not device_type and a.spec:
            device_type = a.spec.device_type
            
        data.append({
            "Asset ID": a.asset_id,
            "Model Name": a.model_name,
            "Device Type": device_type,
            "Initial Age (Months)": a.initial_age,
            "Current Age (Months)": current_age,
            "Current Temp (C)": a.current_temp,
            "Current Usage (Hrs/Week)": a.current_usage,
            "Maintenance Score": a.maint_score,
            "Repairs": a.repairs,
            "Health Score": a.override_score if a.override_score else a.health_score,
            "Override Score": a.override_score,
            "Override Reason": a.override_reason,
            "Is Generic": a.is_generic,
            "Last Updated": a.last_updated.strftime("%Y-%m-%d %H:%M:%S") if a.last_updated else None
        })
    
    df = pd.DataFrame(data)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = StreamingResponse(iter([stream.getvalue()]),
                                 media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=assets_export.csv"
    return response

@router.post("/", response_model=AssetResponse)
def create_asset(asset_in: AssetCreate, db: Session = Depends(get_db)):
    """
    Creates a new asset manually.
    Handles device_type fallback if model is unknown.
    """
    # Check if ID exists (including archived)
    existing_asset = db.query(Asset).filter(Asset.asset_id == asset_in.asset_id).first()
    if existing_asset:
        if not existing_asset.is_active:
             raise HTTPException(status_code=400, detail="Asset ID exists in archive. Restore it instead.")
        raise HTTPException(status_code=400, detail="Asset ID already exists")

    # Determine if we need to use a generic fallback
    is_generic = False
    spec = db.query(Spec).filter(Spec.model_name == asset_in.model_name).first()
    
    if not spec:
        # Fallback logic
        if asset_in.device_type == "laptop":
            spec = db.query(Spec).filter(Spec.model_name == "Generic Laptop").first()
        elif asset_in.device_type == "desktop":
            spec = db.query(Spec).filter(Spec.model_name == "Generic Desktop").first()
        
        if spec:
            is_generic = True

    new_asset = Asset(
        asset_id=asset_in.asset_id,
        model_name=asset_in.model_name,
        device_type=asset_in.device_type,
        initial_age=asset_in.initial_age,
        current_temp=asset_in.current_temp,
        current_usage=asset_in.current_usage,
        maint_score=asset_in.maint_score,
        repairs=asset_in.repairs,
        is_generic=is_generic,
        last_updated=asset_in.last_updated or datetime.utcnow()
    )
    
    db.add(new_asset)
    
    # Log Action
    log = SystemLog(
        action_type="CREATE",
        entity_type="ASSET",
        entity_id=new_asset.asset_id,
        details=f"Manual creation. Model: {new_asset.model_name}, Generic: {new_asset.is_generic}"
    )
    db.add(log)
    
    try:
        db.commit()
        db.refresh(new_asset)
        new_asset.current_age = engine.calculate_current_age(new_asset.initial_age, new_asset.created_at)
        return new_asset
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

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

@router.post("/{asset_id}/diagnose")
def run_single_diagnostic(asset_id: str, db: Session = Depends(get_db)):
    """
    Triggers ML logic for a specific asset.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset or not asset.is_active:
        raise HTTPException(status_code=404, detail="Asset not found")

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
            raise HTTPException(status_code=400, detail="Manufacturer specs missing for this model.")

    features = engine.prepare_features(asset, spec)
    label, cid = engine.predict_health(features)

    asset.health_score = label
    asset.cluster_id = cid
    db.commit()
    return {"asset_id": asset_id, "score": label, "cluster": cid}

@router.post("/bulk-upload")
async def bulk_upload_json(data: List[dict], db: Session = Depends(get_db)):
    """
    Handles JSON payload from frontend's PapaParse.
    Performs upsert with timestamp checking.
    """
    logs = []
    processed_count = 0

    for row in data:
        asset_id = row.get('asset_id')
        if not asset_id:
            logs.append({"status": "skipped", "message": "Row missing asset_id"})
            continue

        incoming_ts = None
        if row.get('last_updated'):
            try:
                incoming_ts = datetime.fromisoformat(row['last_updated'].replace('Z', '+00:00'))
            except ValueError:
                pass 

        existing_asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()

        if existing_asset:
            # If asset was archived, restore it? Or update it but keep it archived?
            # Usually, a new upload implies active status.
            if not existing_asset.is_active:
                existing_asset.is_active = True
                existing_asset.deletion_reason = None
                logs.append({"status": "restored", "message": f"Asset {asset_id} restored from archive."})

            # Temporal Integrity Check
            if existing_asset.last_updated and incoming_ts:
                db_ts = existing_asset.last_updated
                if db_ts.tzinfo is None:
                    db_ts = db_ts.replace(tzinfo=datetime.utcnow().astimezone().tzinfo)
                
                if incoming_ts.tzinfo is None:
                    incoming_ts = incoming_ts.replace(tzinfo=datetime.utcnow().astimezone().tzinfo)

                if db_ts > incoming_ts:
                    logs.append({"status": "skipped", "message": f"Asset {asset_id}: Stale data (DB is newer)."})
                    continue
            
            existing_asset.current_temp = row.get('current_temp', existing_asset.current_temp)
            existing_asset.current_usage = row.get('current_usage', existing_asset.current_usage)
            existing_asset.maint_score = row.get('maint_score', existing_asset.maint_score)
            existing_asset.repairs = row.get('repairs', existing_asset.repairs)
            existing_asset.last_updated = incoming_ts or datetime.utcnow()
            
            logs.append({"status": "updated", "message": f"Asset {asset_id} updated."})

        else:
            new_asset = Asset(
                asset_id=asset_id,
                model_name=row.get('model_name', 'Unknown Model'),
                device_type=row.get('device_type'), 
                initial_age=row.get('initial_age', 0),
                current_temp=row.get('current_temp', 0.0),
                current_usage=row.get('current_usage', 0.0),
                maint_score=row.get('maint_score', 5),
                repairs=row.get('repairs', 0),
                last_updated=incoming_ts or datetime.utcnow()
            )
            db.add(new_asset)
            logs.append({"status": "created", "message": f"Asset {asset_id} onboarded."})

        processed_count += 1

    if processed_count > 0:
        log = SystemLog(
            action_type="UPLOAD",
            entity_type="ASSET",
            entity_id="BATCH",
            details=f"Bulk upload processed {processed_count} records."
        )
        db.add(log)

    try:
        db.commit()
        return {"processed": processed_count, "logs": logs}
    except Exception as e:
        db.rollback()
        print(f"Bulk Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: str, obj_in: AssetUpdate, db: Session = Depends(get_db)):
    """Handles Manager Overrides (Human-in-the-loop)."""
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset or not asset.is_active:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = obj_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(asset, field, value)

    # Log Action
    details = []
    if obj_in.override_score:
         details.append(f"Override: {obj_in.override_score} ({obj_in.override_reason})")
    
    log = SystemLog(
        action_type="UPDATE",
        entity_type="ASSET",
        entity_id=asset_id,
        details=f"Asset updated. {', '.join(details)}" if details else "Asset data updated."
    )
    db.add(log)

    db.commit()
    db.refresh(asset)
    asset.current_age = engine.calculate_current_age(asset.initial_age, asset.created_at)
    return asset

@router.delete("/{asset_id}")
def delete_asset(asset_id: str, reason: str = "Manual Deletion", db: Session = Depends(get_db)):
    """
    Soft-deletes a single asset (Archives it).
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    asset.is_active = False
    asset.deletion_reason = reason
    
    # Log Action
    log = SystemLog(
        action_type="ARCHIVE",
        entity_type="ASSET",
        entity_id=asset_id,
        details=f"Asset archived. Reason: {reason}"
    )
    db.add(log)
    
    db.commit()
    return {"message": f"Asset {asset_id} archived."}

@router.post("/batch-delete")
def delete_assets_batch(payload: AssetBatchSoftDelete, db: Session = Depends(get_db)):
    """
    Soft-deletes multiple assets (Archives them).
    """
    assets = db.query(Asset).filter(Asset.asset_id.in_(payload.asset_ids)).all()
    if not assets:
        raise HTTPException(status_code=404, detail="No matching assets found.")
    
    archived_count = 0
    for asset in assets:
        if asset.is_active:
            asset.is_active = False
            asset.deletion_reason = payload.reason
            archived_count += 1
    
    # Log Action
    log = SystemLog(
        action_type="ARCHIVE",
        entity_type="ASSET",
        entity_id="BATCH",
        details=f"Batch archive: {archived_count} assets hidden. Reason: {payload.reason}"
    )
    db.add(log)
    
    db.commit()
    return {"message": f"{archived_count} assets archived."}

@router.post("/{asset_id}/restore")
def restore_asset(asset_id: str, db: Session = Depends(get_db)):
    """
    Restores a soft-deleted asset.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    if asset.is_active:
        return {"message": "Asset is already active."}

    asset.is_active = True
    asset.deletion_reason = None
    
    # Log Action
    log = SystemLog(
        action_type="RESTORE",
        entity_type="ASSET",
        entity_id=asset_id,
        details="Asset restored from archive."
    )
    db.add(log)
    
    db.commit()
    return {"message": f"Asset {asset_id} restored."}