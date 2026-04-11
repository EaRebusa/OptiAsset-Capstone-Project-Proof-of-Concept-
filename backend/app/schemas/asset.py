from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class AssetBase(BaseModel):
    asset_id: str
    model_name: str
    device_type: Optional[str] = None # Added device_type
    initial_age: int = Field(..., ge=0, description="Age must be 0 or greater")
    current_temp: float = Field(..., ge=10, le=120, description="Temperature must be between 10°C and 120°C")
    current_usage: float = Field(..., ge=0, le=168, description="Usage must be between 0 and 168 hours/week")
    maint_score: int = Field(..., ge=1, le=10, description="Maintenance score must be between 1 and 10")
    repairs: int = Field(..., ge=0, description="Repairs must be 0 or greater")

class AssetCreate(AssetBase):
    last_updated: Optional[datetime] = None

class AssetUpdate(BaseModel):
    """
    Schema for updating asset data (data correction) and applying manual overrides (label override).
    """
    # Data Correction Fields
    initial_age: Optional[int] = Field(None, ge=0)
    current_temp: Optional[float] = Field(None, ge=10, le=120)
    current_usage: Optional[float] = Field(None, ge=0, le=168)
    maint_score: Optional[int] = Field(None, ge=1, le=10)
    repairs: Optional[int] = Field(None, ge=0)

    # Label Override Fields
    override_score: Optional[str] = None
    override_reason: Optional[str] = None

class AssetBatchDelete(BaseModel):
    asset_ids: List[str]

class AssetSoftDelete(BaseModel):
    reason: str

class AssetBatchSoftDelete(BaseModel):
    asset_ids: List[str]
    reason: str

class AssetResponse(AssetBase):
    id: int
    created_at: datetime
    health_score: str
    cluster_id: Optional[int]
    current_age: Optional[int]
    override_score: Optional[str]
    override_reason: Optional[str]
    is_generic: bool = False # Added is_generic
    is_active: bool = True
    deletion_reason: Optional[str] = None

    class Config:
        from_attributes = True