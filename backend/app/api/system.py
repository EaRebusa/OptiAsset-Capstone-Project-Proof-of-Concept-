from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.schemas import Asset, SystemLog
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