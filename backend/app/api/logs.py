from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.schemas import SystemLog
from app.schemas.log import LogResponse

router = APIRouter(prefix="/logs", tags=["Action Logs"])

@router.get("/", response_model=List[LogResponse])
def get_logs(limit: int = 50, db: Session = Depends(get_db)):
    """
    Fetch system action logs, ordered by most recent first.
    """
    return db.query(SystemLog).order_by(SystemLog.timestamp.desc()).limit(limit).all()