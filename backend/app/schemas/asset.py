from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class AssetBase(BaseModel):
    asset_id: str
    model_name: str
    current_temp: float
    current_usage: float
    maint_score: int
    repairs: int

class AssetCreate(AssetBase):
    initial_age: int

class AssetUpdate(BaseModel):
    current_temp: Optional[float] = None
    current_usage: Optional[float] = None
    maint_score: Optional[int] = None
    repairs: Optional[int] = None
    override_score: Optional[str] = None
    override_reason: Optional[str] = None

class AssetResponse(AssetBase):
    id: int
    initial_age: int
    current_age: int # Calculated field
    health_score: str
    cluster_id: Optional[int]
    created_at: datetime
    last_updated: datetime

    class Config:
        from_attributes = True