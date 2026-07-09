from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.websocket.manager import manager
import json

router = APIRouter()

@router.websocket("/ws/{session_code}")
async def websocket_endpoint(websocket: WebSocket, session_code: str, role: str = "customer"):
    await manager.connect(websocket, session_code, role)
    try:
        while True:
            data = await websocket.receive_text()
            # Parse and broadcast. Expected data: {"type": "offer/answer/ice/chat", "payload": ...}
            try:
                parsed_data = json.loads(data)
                # Attach sender role for context
                parsed_data["sender_role"] = role
                await manager.broadcast_to_session(json.dumps(parsed_data), session_code, sender=websocket)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_code)
        await manager.broadcast_to_session(json.dumps({"type": "system", "message": f"{role} disconnected"}), session_code)
