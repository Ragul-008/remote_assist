from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Optional

from app.database.connection import get_database
from app.schemas.audit import AuditLogResponse
from app.auth.dependencies import get_current_technician

router = APIRouter()

@router.get("/", response_model=list[AuditLogResponse])
async def list_audit_logs(
    action: Optional[str] = None,
    session_code: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    query = {}
    if action and action != "all":
        query["action"] = action
    if session_code:
        query["session_code"] = session_code

    logs = await db.audit_logs.find(query).sort("timestamp", -1).to_list(length=limit)
    result = []
    for log in logs:
        log["id"] = str(log["_id"])
        result.append(log)
    return result

@router.get("/stats")
async def get_system_stats(
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    now = datetime.utcnow()
    twenty_four_hours_ago = now - timedelta(hours=24)
    sixty_seconds_ago = now - timedelta(seconds=60)

    total_sessions = await db.sessions.count_documents({})
    active_sessions = await db.sessions.count_documents({"status": "active"})
    today_sessions = await db.sessions.count_documents({"start_time": {"$gte": twenty_four_hours_ago}})
    
    total_devices = await db.devices.count_documents({})
    online_devices = await db.devices.count_documents({"last_seen": {"$gte": sixty_seconds_ago}})
    
    total_users = await db.users.count_documents({})
    total_technicians = await db.users.count_documents({"role": {"$in": ["technician", "admin"]}})

    return {
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "today_sessions": today_sessions,
        "total_devices": total_devices,
        "online_devices": online_devices,
        "offline_devices": max(0, total_devices - online_devices),
        "total_users": total_users,
        "total_technicians": total_technicians
    }

