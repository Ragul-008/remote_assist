from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.connection import get_database
from app.schemas.session import SessionResponse, SessionStatus
from app.auth.dependencies import get_current_technician, get_current_active_user
import uuid
import random
import string
from datetime import datetime
import httpx

router = APIRouter()

def generate_session_code():
    return ''.join(random.choices(string.digits, k=9))

@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    session_code = generate_session_code()
    session_dict = {
        "session_code": session_code,
        "technician_id": current_user["id"],
        "customer_id": None,
        "status": SessionStatus.PENDING,
        "start_time": datetime.utcnow(),
        "end_time": None
    }
    
    new_session = await db.sessions.insert_one(session_dict)
    created_session = await db.sessions.find_one({"_id": new_session.inserted_id})
    created_session["id"] = str(created_session["_id"])
    return created_session

@router.get("/", response_model=list[SessionResponse])
async def list_sessions(
    current_user: dict = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # If technician, get all their sessions. If customer, get all their joined sessions.
    if current_user.get("role") == "technician":
        cursor = db.sessions.find({"technician_id": current_user["id"]})
    else:
        cursor = db.sessions.find({"customer_id": current_user["id"]})
        
    sessions = await cursor.to_list(length=100)
    for s in sessions:
        s["id"] = str(s["_id"])
    return sessions

@router.get("/customers")
async def list_customers(
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Fetch unique customers the technician has supported
    pipeline = [
        {"$match": {"technician_id": current_user["id"], "customer_id": {"$ne": None}}},
        {"$group": {
            "_id": "$customer_id",
            "total_sessions": {"$sum": 1},
            "last_session": {"$max": "$start_time"}
        }}
    ]
    
    customers_data = await db.sessions.aggregate(pipeline).to_list(length=100)
    
    # Enrich with customer details
    result = []
    for c in customers_data:
        from bson.objectid import ObjectId
        customer = await db.users.find_one({"_id": ObjectId(c["_id"])})
        if customer:
            result.append({
                "id": str(customer["_id"]),
                "name": customer.get("name", "Unknown"),
                "email": customer.get("email", ""),
                "total_sessions": c["total_sessions"],
                "last_session": c["last_session"]
            })
            
    return result

@router.post("/join/{session_code}", response_model=SessionResponse)
async def join_session(
    session_code: str,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    session = await db.sessions.find_one({"session_code": session_code, "status": SessionStatus.PENDING})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already active")
        
    await db.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"customer_id": current_user["id"], "status": SessionStatus.ACTIVE}}
    )
    
    updated_session = await db.sessions.find_one({"_id": session["_id"]})
    updated_session["id"] = str(updated_session["_id"])
    return updated_session

@router.put("/code/{session_code}/end")
async def end_session(
    session_code: str,
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    session = await db.sessions.find_one({"session_code": session_code, "technician_id": current_user["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await db.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"status": SessionStatus.COMPLETED, "end_time": datetime.utcnow()}}
    )
    return {"message": "Session ended successfully"}

@router.get("/{session_code}/download")
async def download_app(session_code: str):
    # This URL must point to the GitHub release portable executable (zip)
    github_url = "https://github.com/Ragul-008/remote_assist/releases/latest/download/RemoteAssist-Portable-New.zip"
    
    async def fetch_stream():
        async with httpx.AsyncClient(follow_redirects=True) as client:
            async with client.stream('GET', github_url) as response:
                if response.status_code != 200:
                    yield b""
                    return
                async for chunk in response.aiter_bytes():
                    yield chunk

    return StreamingResponse(
        fetch_stream(), 
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="RemoteAssist_Session_{session_code}.zip"'
        }
    )
