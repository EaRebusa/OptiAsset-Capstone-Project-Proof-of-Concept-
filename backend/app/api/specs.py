from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict
from app.db.session import get_db
from app.models.schemas import Spec, Asset, SystemLog
from app.schemas.spec import SpecCreate, SpecUpdate, SpecResponse

router = APIRouter(prefix="/specs", tags=["Specs Library"])

@router.get("/", response_model=List[dict])
def get_specs(db: Session = Depends(get_db)):
    """
    Fetch all specs with asset count for fleet coverage.
    """
    specs = db.query(Spec).all()
    results = []
    
    for spec in specs:
        # Count assets using this spec (by model name)
        count = db.query(Asset).filter(Asset.model_name == spec.model_name).count()
        
        # Identify if it's a generic fallback
        is_generic = "Generic" in spec.model_name
        
        results.append({
            "id": spec.id,
            "device_type": spec.device_type,
            "model_name": spec.model_name,
            "temp_norm": spec.temp_norm,
            "usage_norm": spec.usage_norm,
            "warranty_months": spec.warranty_months,
            "asset_count": count,
            "is_generic": is_generic
        })
    
    return results

@router.get("/stats", response_model=dict)
def get_spec_stats(db: Session = Depends(get_db)):
    """
    Returns statistics for the dashboard mini-cards.
    """
    total_models = db.query(Spec).count()
    generic_fallbacks = db.query(Spec).filter(Spec.model_name.like("%Generic%")).count()
    
    # Calculate fleet coverage: Percentage of assets with a valid (non-generic) spec
    total_assets = db.query(Asset).count()
    if total_assets > 0:
        # Assets with non-generic specs
        # We assume assets with is_generic=False are covered by specific specs
        covered_assets = db.query(Asset).filter(Asset.is_generic == False).count()
        coverage_percent = round((covered_assets / total_assets) * 100, 1)
    else:
        coverage_percent = 0.0

    return {
        "total_models": total_models,
        "generic_fallbacks": generic_fallbacks,
        "fleet_coverage": coverage_percent
    }

@router.post("/", response_model=SpecResponse)
def create_spec(spec_in: SpecCreate, db: Session = Depends(get_db)):
    """
    Add a new hardware baseline.
    """
    existing_spec = db.query(Spec).filter(Spec.model_name == spec_in.model_name).first()
    if existing_spec:
        raise HTTPException(status_code=400, detail="Spec for this model already exists.")

    new_spec = Spec(
        device_type=spec_in.device_type,
        model_name=spec_in.model_name,
        temp_norm=spec_in.temp_norm,
        usage_norm=spec_in.usage_norm,
        warranty_months=spec_in.warranty_months
    )
    db.add(new_spec)
    
    # Log Action
    log = SystemLog(
        action_type="CREATE",
        entity_type="SPEC",
        entity_id=new_spec.model_name,
        details=f"Created baseline: {new_spec.model_name} (T:{new_spec.temp_norm}, U:{new_spec.usage_norm})"
    )
    db.add(log)
    
    db.commit()
    db.refresh(new_spec)
    return new_spec

@router.put("/{model_name}", response_model=SpecResponse)
def update_spec(model_name: str, spec_in: SpecUpdate, db: Session = Depends(get_db)):
    """
    Update baseline thresholds.
    Triggers a flag recommendation for re-scoring in frontend.
    """
    # Handle URL decoding if necessary, but FastAPI handles path params well.
    # Note: model_name might contain spaces or special chars.
    
    spec = db.query(Spec).filter(Spec.model_name == model_name).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found.")

    update_data = spec_in.dict(exclude_unset=True)
    changes = []
    for field, value in update_data.items():
        old_val = getattr(spec, field)
        if old_val != value:
            changes.append(f"{field}: {old_val} -> {value}")
            setattr(spec, field, value)

    if changes:
        # Log Action
        log = SystemLog(
            action_type="UPDATE",
            entity_type="SPEC",
            entity_id=model_name,
            details=f"Updated baseline: {', '.join(changes)}"
        )
        db.add(log)

    db.commit()
    db.refresh(spec)
    return spec

@router.delete("/{model_name}")
def delete_spec(model_name: str, db: Session = Depends(get_db)):
    """
    Remove a baseline.
    Assets using this model will fallback to Generic specs upon next diagnosis.
    """
    spec = db.query(Spec).filter(Spec.model_name == model_name).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Spec not found.")
    
    if "Generic" in spec.model_name:
         raise HTTPException(status_code=400, detail="Cannot delete a Generic Safety Net spec.")

    # Check if assets are using this spec
    assets_using = db.query(Asset).filter(Asset.model_name == model_name).all()
    count = len(assets_using)
    
    db.delete(spec)
    
    # Log Action
    log = SystemLog(
        action_type="DELETE",
        entity_type="SPEC",
        entity_id=model_name,
        details=f"Deleted baseline. {count} assets will fallback to Generic specs."
    )
    db.add(log)
    
    db.commit()
    
    return {"message": f"Spec for {model_name} deleted. {count} assets will fallback to generic specs."}