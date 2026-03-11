from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LogBase(BaseModel):
    action_type: str
    entity_type: str
    entity_id: str
    details: Optional[str] = None

class LogCreate(LogBase):
    pass

class LogResponse(LogBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True