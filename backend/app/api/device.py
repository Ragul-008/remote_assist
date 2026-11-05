from fastapi import APIRouter, Depends, HTTPException, status, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson.objectid import ObjectId
from datetime import datetime, timedelta
import uuid
import random
import string

from app.database.connection import get_database
from app.database.audit import record_audit_log
from app.schemas.device import (
    DeviceRegister, DeviceUpdate, DeviceHeartbeat, DeviceResponse, DeviceStatus
)
from app.schemas.session import SessionResponse, SessionStatus
from app.auth.dependencies import get_current_technician, get_current_active_user

router = APIRouter()

def is_device_online(last_seen: datetime) -> bool:
    # Online if heartbeat received in the last 60 seconds
    return (datetime.utcnow() - last_seen) < timedelta(seconds=60)

@router.post("/register", response_model=DeviceResponse)
async def register_device(
    device_data: DeviceRegister,
    request: Request,
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    device_key = device_data.device_key or str(uuid.uuid4())
    client_ip = request.client.host if request.client else device_data.ip_address

    existing = await db.devices.find_one({"device_key": device_key})
    now = datetime.utcnow()

    if existing:
        update_fields = {
            "name": device_data.name,
            "hostname": device_data.hostname,
            "os_info": device_data.os_info,
            "platform": device_data.platform,
            "ip_address": client_ip,
            "last_seen": now,
            "group": device_data.group or existing.get("group", "Default")
        }
        if device_data.system_info:
            update_fields["system_info"] = device_data.system_info

        await db.devices.update_one({"_id": existing["_id"]}, {"$set": update_fields})
        updated = await db.devices.find_one({"_id": existing["_id"]})
        updated["id"] = str(updated["_id"])
        updated["status"] = DeviceStatus.ONLINE
        return updated

    new_device = {
        "device_key": device_key,
        "name": device_data.name,
        "hostname": device_data.hostname or device_data.name,
        "os_info": device_data.os_info or "Windows",
        "platform": device_data.platform or "win32",
        "ip_address": client_ip,
        "group": device_data.group or "Default",
        "registered_by": current_user["id"],
        "registered_by_name": current_user.get("name", "Technician"),
        "created_at": now,
        "last_seen": now,
        "system_info": device_data.system_info or {}
    }

    result = await db.devices.insert_one(new_device)
    created = await db.devices.find_one({"_id": result.inserted_id})
    created["id"] = str(created["_id"])
    created["status"] = DeviceStatus.ONLINE

    await record_audit_log(
        db,
        action="device_registered",
        details=f"Unattended device '{created['name']}' registered by {current_user.get('name')}",
        user=current_user,
        device_id=created["id"],
        ip_address=client_ip
    )

    return created

@router.get("/", response_model=list[DeviceResponse])
async def list_devices(
    group: str = None,
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    query = {}
    # Admins see all devices, technicians see devices they or their org registered
    if current_user.get("role") != "admin":
        query["registered_by"] = current_user["id"]
    if group and group != "All":
        query["group"] = group

    devices = await db.devices.find(query).sort("last_seen", -1).to_list(length=200)
    result = []
    for d in devices:
        d["id"] = str(d["_id"])
        last_seen = d.get("last_seen", datetime.min)
        d["status"] = DeviceStatus.ONLINE if is_device_online(last_seen) else DeviceStatus.OFFLINE
        result.append(d)
    return result

@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        obj_id = ObjectId(device_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid device ID format")

    device = await db.devices.find_one({"_id": obj_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device["id"] = str(device["_id"])
    last_seen = device.get("last_seen", datetime.min)
    device["status"] = DeviceStatus.ONLINE if is_device_online(last_seen) else DeviceStatus.OFFLINE
    return device

@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str,
    update_data: DeviceUpdate,
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        obj_id = ObjectId(device_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid device ID format")

    device = await db.devices.find_one({"_id": obj_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    updates = {k: v for k, v in update_data.model_dump(exclude_unset=True).items() if v is not None}
    if updates:
        await db.devices.update_one({"_id": obj_id}, {"$set": updates})

    updated = await db.devices.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    last_seen = updated.get("last_seen", datetime.min)
    updated["status"] = DeviceStatus.ONLINE if is_device_online(last_seen) else DeviceStatus.OFFLINE
    return updated

@router.delete("/{device_id}")
async def delete_device(
    device_id: str,
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        obj_id = ObjectId(device_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid device ID format")

    device = await db.devices.find_one({"_id": obj_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    await db.devices.delete_one({"_id": obj_id})

    await record_audit_log(
        db,
        action="device_deleted",
        details=f"Unattended device '{device.get('name')}' removed by {current_user.get('name')}",
        user=current_user,
        device_id=device_id
    )

    return {"message": "Device successfully unregistered"}

@router.post("/{device_key}/heartbeat")
async def device_heartbeat(
    device_key: str,
    heartbeat: DeviceHeartbeat,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    device = await db.devices.find_one({"device_key": device_key})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found or not registered")

    client_ip = request.client.host if request.client else heartbeat.ip_address
    update_data = {
        "last_seen": datetime.utcnow(),
        "ip_address": client_ip
    }
    if heartbeat.system_info:
        update_data["system_info"] = heartbeat.system_info

    active_code = device.get("active_session_code")
    if active_code:
        # Consume the connection request so it only fires once
        await db.devices.update_one(
            {"_id": device["_id"]}, 
            {"$set": update_data, "$unset": {"active_session_code": "", "session_requested_at": ""}}
        )
    else:
        await db.devices.update_one({"_id": device["_id"]}, {"$set": update_data})

    return {
        "status": "ok", 
        "timestamp": datetime.utcnow(),
        "active_session_code": active_code
    }

@router.post("/{device_id}/connect", response_model=SessionResponse)
async def connect_unattended_device(
    device_id: str,
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        obj_id = ObjectId(device_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid device ID format")

    device = await db.devices.find_one({"_id": obj_id})
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Generate 9-digit session code
    session_code = ''.join(random.choices(string.digits, k=9))
    now = datetime.utcnow()

    session_dict = {
        "session_code": session_code,
        "technician_id": current_user["id"],
        "customer_id": None,
        "status": SessionStatus.ACTIVE,
        "start_time": now,
        "end_time": None,
        "is_unattended": True,
        "device_id": device_id,
        "device_name": device.get("name", "Unattended Computer"),
        "technician_name": current_user.get("name", "Technician"),
        "notes": f"Unattended access session to {device.get('name')}"
    }

    new_session = await db.sessions.insert_one(session_dict)
    created_session = await db.sessions.find_one({"_id": new_session.inserted_id})
    created_session["id"] = str(created_session["_id"])

    # Update device pending connection flag in db
    await db.devices.update_one(
        {"_id": obj_id},
        {"$set": {"active_session_code": session_code, "session_requested_at": now}}
    )

    await record_audit_log(
        db,
        action="device_connected",
        details=f"Unattended connection initiated to '{device.get('name')}' by {current_user.get('name')} (Session {session_code})",
        user=current_user,
        session_code=session_code,
        device_id=device_id
    )

    return created_session

