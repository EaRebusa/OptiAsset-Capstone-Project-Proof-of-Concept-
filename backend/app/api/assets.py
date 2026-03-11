from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Body
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional, Dict
import pandas as pd
import io
from datetime import datetime
from app.db.session import get_db, SessionLocal
from app.models.schemas import Asset, Spec, SystemLog
from app.schemas.asset import AssetResponse, AssetUpdate, AssetCreate
from app.core.engine import engine

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("/", response_model=List[AssetResponse])
def get_assets(search: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Fetches all assets with live age calculation.
    Can be filtered by a search term, which can be a health status or a text search on asset ID/model name.
    """
    query = db.query(Asset)
    
    # Apply filtering logic
    if search:
        # Check if the search term matches any health status
        health_statuses = ["Healthy", "Warning", "Critical", "Unscored"]
        
        # We need to construct a complex filter because "Healthy" could be in health_score OR override_score
        status_conditions = []
        
        # If the search term is exactly one of the known statuses, we prioritize filtering by status logic
        if search in health_statuses:
            # Case 1: The asset has an override_score matching the search
            cond1 = Asset.override_score == search
            # Case 2: The asset has NO override_score, but its computed health_score matches
            cond2 = and_(Asset.override_score == None, Asset.health_score == search)
            
            query = query.filter(or_(cond1, cond2))
        else:
            # General text search on ID or Model
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
    return assets

@router.post("/", response_model=AssetResponse)
def create_asset(asset_in: AssetCreate, db: Session = Depends(get_db)):
    """
    Creates a new asset manually.
    Handles device_type fallback if model is unknown.
    """
    existing_asset = db.query(Asset).filter(Asset.asset_id == asset_in.asset_id).first()
    if existing_asset:
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
            assets = db.query(Asset).all()
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
    Required by App.jsx handleDiagnose function.
    """
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
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

        # Try to parse the incoming timestamp
        incoming_ts = None
        if row.get('last_updated'):
            try:
                # Handle both ISO format and simple date strings if necessary
                incoming_ts = datetime.fromisoformat(row['last_updated'].replace('Z', '+00:00'))
            except ValueError:
                pass 

        existing_asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()

        if existing_asset:
            # Temporal Integrity Check
            # Ensure both timestamps are timezone-aware or both are naive before comparing
            if existing_asset.last_updated and incoming_ts:
                db_ts = existing_asset.last_updated
                if db_ts.tzinfo is None:
                    # If DB timestamp is naive, assume UTC
                    db_ts = db_ts.replace(tzinfo=datetime.utcnow().astimezone().tzinfo)
                
                if incoming_ts.tzinfo is None:
                    # If incoming timestamp is naive, assume UTC
                    incoming_ts = incoming_ts.replace(tzinfo=datetime.utcnow().astimezone().tzinfo)

                # If DB has a newer timestamp than the CSV, we skip this row.
                if db_ts > incoming_ts:
                    logs.append({"status": "skipped", "message": f"Asset {asset_id}: Stale data (DB is newer)."})
                    continue
            
            # Update existing asset
            existing_asset.current_temp = row.get('current_temp', existing_asset.current_temp)
            existing_asset.current_usage = row.get('current_usage', existing_asset.current_usage)
            existing_asset.maint_score = row.get('maint_score', existing_asset.maint_score)
            existing_asset.repairs = row.get('repairs', existing_asset.repairs)
            existing_asset.last_updated = incoming_ts or datetime.utcnow()
            
            logs.append({"status": "updated", "message": f"Asset {asset_id} updated."})

        else:
            # Create new asset
            new_asset = Asset(
                asset_id=asset_id,
                model_name=row.get('model_name', 'Unknown Model'),
                device_type=row.get('device_type'), # Added device_type
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
            details=f"Bulk upload processed {processed_count} records. Created/Updated assets."
        )
        db.add(log)

    try:
        db.commit()
        return {"processed": processed_count, "logs": logs}
    except Exception as e:
        db.rollback()
        # Log the actual error for debugging
        print(f"Bulk Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: str, obj_in: AssetUpdate, db: Session = Depends(get_db)):
    """Handles Manager Overrides (Human-in-the-loop)."""
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
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