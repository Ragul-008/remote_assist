from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DeviceStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    IN_SESSION = "in-session"

class DeviceBase(BaseModel):
    name: str
    hostname: Optional[str] = None
    os_info: Optional[str] = "Windows"
    platform: Optional[str] = "win32"
    ip_address: Optional[str] = None
    group: Optional[str] = "Default"

class DeviceRegister(DeviceBase):
    device_key: Optional[str] = None
    system_info: Optional[Dict[str, Any]] = None

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    group: Optional[str] = None

class DeviceHeartbeat(BaseModel):
    device_key: str
    ip_address: Optional[str] = None
    system_info: Optional[Dict[str, Any]] = None

class DeviceResponse(DeviceBase):
    id: str
    device_key: str
    status: DeviceStatus = DeviceStatus.OFFLINE
    registered_by: str
    registered_by_name: Optional[str] = None
    last_seen: datetime
    created_at: datetime
    system_info: Optional[Dict[str, Any]] = None

