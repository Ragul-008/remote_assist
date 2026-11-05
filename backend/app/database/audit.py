from datetime import datetime
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

async def record_audit_log(
    db: AsyncIOMotorDatabase,
    action: str,
    details: str,
    user: Optional[dict] = None,
    session_code: Optional[str] = None,
    device_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    try:
        log_entry = {
            "timestamp": datetime.utcnow(),
            "action": action,
            "details": details,
            "user_id": str(user.get("id") or user.get("_id")) if user else None,
            "user_name": user.get("name") if user else None,
            "user_email": user.get("email") if user else None,
            "user_role": user.get("role") if user else None,
            "session_code": session_code,
            "device_id": device_id,
            "ip_address": ip_address,
            "metadata": metadata or {}
        }
        await db.audit_logs.insert_one(log_entry)
    except Exception as e:
        print(f"[AUDIT LOG ERROR] Failed to record audit log: {e}")

