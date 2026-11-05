from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class SessionStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"

class SessionBase(BaseModel):
    session_code: str
    technician_id: str
    customer_id: Optional[str] = None
    status: SessionStatus = SessionStatus.PENDING
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None
    is_unattended: bool = False
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    customer_name: Optional[str] = None
    technician_name: Optional[str] = None

class SessionCreate(BaseModel):
    device_id: Optional[str] = None
    notes: Optional[str] = None

class SessionNotesUpdate(BaseModel):
    notes: str

class SessionInDB(SessionBase):
    id: str = Field(alias="_id")
    start_time: datetime
    end_time: Optional[datetime] = None

class SessionResponse(SessionBase):
    id: str
    start_time: datetime
    end_time: Optional[datetime] = None
