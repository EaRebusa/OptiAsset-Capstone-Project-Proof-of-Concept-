from pydantic import BaseModel, Field
from typing import Optional

class SpecBase(BaseModel):
    device_type: str
    model_name: str
    temp_norm: float = Field(..., gt=0, le=120, description="Temperature Norm in Celsius (0-120)")
    usage_norm: float = Field(..., gt=0, le=168, description="Usage Norm in Hours/Week (0-168)")
    warranty_months: int = Field(..., gt=0, le=120, description="Warranty Period in Months (0-120)")

class SpecCreate(SpecBase):
    pass

class SpecUpdate(BaseModel):
    temp_norm: Optional[float] = Field(None, gt=0, le=120)
    usage_norm: Optional[float] = Field(None, gt=0, le=168)
    warranty_months: Optional[int] = Field(None, gt=0, le=120)

class SpecResponse(SpecBase):
    id: int

    class Config:
        from_attributes = True