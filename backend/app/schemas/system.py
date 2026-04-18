from pydantic import BaseModel
from typing import List

class SystemSettingsBase(BaseModel):
    warning_multiplier: float
    critical_multiplier: float
    fallback_laptop_cost: float
    fallback_desktop_cost: float

class SystemSettingsUpdate(SystemSettingsBase):
    pass

class SystemSettingsResponse(SystemSettingsBase):
    id: int
    class Config:
        from_attributes = True

class ClusterDataResponse(BaseModel):
    features: List[List[float]]
    labels: List[int]
    class Config:
        from_attributes = True