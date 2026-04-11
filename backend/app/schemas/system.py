from pydantic import BaseModel

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