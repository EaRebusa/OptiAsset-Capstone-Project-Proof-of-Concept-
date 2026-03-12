from pydantic import BaseModel, Field
from typing import Optional

class SpecBase(BaseModel):
    device_type: str
    model_name: str
    temp_norm: float = Field(..., gt=0, le=120, description="Temperature Norm in Celsius (0-120)")
    usage_norm: float = Field(..., gt=0, le=168, description="Usage Norm in Hours/Week (0-168)")
    warranty_months: int = Field(..., gt=0, le=120, description="Warranty Period in Months (0-120)")
    replacement_cost: float = Field(..., ge=0, description="Procurement Price in PHP")

class SpecCreate(SpecBase):
    pass

class SpecUpdate(BaseModel):
    temp_norm: Optional[float] = Field(None, gt=0, le=120)
    usage_norm: Optional[float] = Field(None, gt=0, le=168)
    warranty_months: Optional[int] = Field(None, gt=0, le=120)
    replacement_cost: Optional[float] = Field(None, ge=0)

class SpecResponse(SpecBase):
    id: int
    is_generic: bool = False # Added field to match model logic if needed, though mostly handled in backend

    class Config:
        from_attributes = True