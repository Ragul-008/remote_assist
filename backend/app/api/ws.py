from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.manager import manager
from app.database.connection import get_database
from app.auth.security import SECRET_KEY, ALGORITHM
import jwt
from jwt.exceptions import PyJWTError
import json

router = APIRouter()

@router.websocket("/ws/{session_code}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_code: str,
    role: str = "customer",
    token: str | None = None
):
    db = get_database()
    
    # 1. Verify session exists and is not completed
    session = await db.sessions.find_one({"session_code": session_code})
    if not session:
        await websocket.accept()
        await websocket.close(code=4004, reason="Session not found")
        return
        
    if session.get("status") == "completed":
        await websocket.accept()
        await websocket.close(code=4003, reason="Session is already ended/completed")
        return

    # 2. Strict Authentication for Technician
    if role == "technician":
        if not token:
            await websocket.accept()
            await websocket.close(code=4001, reason="Authentication token required for technician")
            return
            
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if not email:
                await websocket.accept()
                await websocket.close(code=4001, reason="Invalid token")
                return
                
            tech_user = await db.users.find_one({"email": email})
            if not tech_user or tech_user.get("role") != "technician":
                await websocket.accept()
                await websocket.close(code=4003, reason="Unauthorized: User is not a technician")
                return
                
            # Verify technician owns this session
            if session.get("technician_id") != str(tech_user["_id"]):
                await websocket.accept()
                await websocket.close(code=4003, reason="Unauthorized: You do not own this support session")
                return
        except PyJWTError:
            await websocket.accept()
            await websocket.close(code=4001, reason="Expired or invalid token")
            return

    # 3. Connect securely
    await manager.connect(websocket, session_code, role)
    
    # If customer connects, update session status to ACTIVE
    if role == "customer" and session.get("status") == "pending":
        await db.sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"status": "active"}}
        )

    try:
        while True:
            data = await websocket.receive_text()
            try:
                parsed_data = json.loads(data)
                msg_type = parsed_data.get("type")

                # SECURITY GUARD: Only the authenticated technician can send control or elevation commands
                if msg_type in ["control", "elevate-session"] and role != "technician":
                    print(f"[SECURITY ALERT] Blocked unauthorized {msg_type} command from role={role} in session {session_code}")
                    continue

                parsed_data["sender_role"] = role
                await manager.broadcast_to_session(json.dumps(parsed_data), session_code, sender=websocket)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_code)
        await manager.broadcast_to_session(
            json.dumps({"type": "system", "message": f"{role} disconnected"}), 
            session_code
        )
