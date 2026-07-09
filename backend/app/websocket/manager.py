from fastapi import WebSocket
from typing import Dict, List
import json

class ConnectionManager:
    def __init__(self):
        # Maps session_code -> list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Maps websocket -> user role (technician or customer)
        self.connection_roles: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, session_code: str, role: str):
        await websocket.accept()
        if session_code not in self.active_connections:
            self.active_connections[session_code] = []
        self.active_connections[session_code].append(websocket)
        self.connection_roles[websocket] = role

    def disconnect(self, websocket: WebSocket, session_code: str):
        if session_code in self.active_connections:
            if websocket in self.active_connections[session_code]:
                self.active_connections[session_code].remove(websocket)
                if not self.active_connections[session_code]:
                    del self.active_connections[session_code]
        if websocket in self.connection_roles:
            del self.connection_roles[websocket]

    async def broadcast_to_session(self, message: str, session_code: str, sender: WebSocket = None):
        if session_code in self.active_connections:
            for connection in self.active_connections[session_code]:
                if connection != sender:
                    await connection.send_text(message)
                    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()
