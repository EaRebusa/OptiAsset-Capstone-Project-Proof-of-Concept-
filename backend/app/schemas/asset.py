from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AssetBase(BaseModel):
    asset_id: str
    model_name: str
    device_type: Optional[str] = None # Added device_type
    initial_age: int
    current_temp: float
    current_usage: float
    maint_score: int
    repairs: int

class AssetCreate(AssetBase):
    last_updated: Optional[datetime] = None

class AssetUpdate(BaseModel):
    """
    Schema for updating asset data (data correction) and applying manual overrides (label override).
    """
    # Data Correction Fields
    initial_age: Optional[int] = None
    current_temp: Optional[float] = None
    current_usage: Optional[float] = None
    maint_score: Optional[int] = None
    repairs: Optional[int] = None

    # Label Override Fields
    override_score: Optional[str] = None
    override_reason: Optional[str] = None

class AssetResponse(AssetBase):
    id: int
    created_at: datetime
    health_score: str
    cluster_id: Optional[int]
    current_age: Optional[int]
    override_score: Optional[str]
    override_reason: Optional[str]
    is_generic: bool = False # Added is_generic

    class Config:
        from_attributes = True