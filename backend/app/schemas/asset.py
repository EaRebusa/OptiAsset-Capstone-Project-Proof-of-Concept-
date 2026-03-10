from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AssetBase(BaseModel):
    asset_id: str
    model_name: str
    initial_age: int
    current_temp: float
    current_usage: float
    maint_score: int
    repairs: int

class AssetUpdate(BaseModel):
    """
    Schema for updating asset data or applying manual overrides.
    Required for the 'Manager Override' feature in Phase 3.
    """
    current_temp: Optional[float] = None
    current_usage: Optional[float] = None
    maint_score: Optional[int] = None
    repairs: Optional[int] = None
    health_score: Optional[str] = None
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

    class Config:
        from_attributes = True