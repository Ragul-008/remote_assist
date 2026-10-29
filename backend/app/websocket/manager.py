from fastapi import WebSocket
from typing import Dict, List
import json

class ConnectionManager:
    def __init__(self):
        # Maps session_code -> list of active WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Maps websocket -> user role (technician or customer)
        self.connection_roles: Dict[WebSocket, str] = {}
        # Maps session_code -> active technician websocket
        self.session_technicians: Dict[str, WebSocket] = {}
        # Maps session_code -> active customer websocket
        self.session_customers: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_code: str, role: str):
        await websocket.accept()
        
        # Enforce single connection per role to prevent stream hijacking / eavesdropping
        if role == "technician" and session_code in self.session_technicians:
            old_ws = self.session_technicians[session_code]
            if old_ws != websocket:
                try:
                    await old_ws.close(code=4000, reason="Replaced by new technician connection")
                except Exception:
                    pass
                self.disconnect(old_ws, session_code)
                
        elif role == "customer" and session_code in self.session_customers:
            old_ws = self.session_customers[session_code]
            if old_ws != websocket:
                try:
                    await old_ws.close(code=4000, reason="Replaced by new customer connection")
                except Exception:
                    pass
                self.disconnect(old_ws, session_code)

        if session_code not in self.active_connections:
            self.active_connections[session_code] = []
        self.active_connections[session_code].append(websocket)
        self.connection_roles[websocket] = role

        if role == "technician":
            self.session_technicians[session_code] = websocket
        elif role == "customer":
            self.session_customers[session_code] = websocket

    def disconnect(self, websocket: WebSocket, session_code: str):
        if session_code in self.active_connections:
            if websocket in self.active_connections[session_code]:
                self.active_connections[session_code].remove(websocket)
                if not self.active_connections[session_code]:
                    del self.active_connections[session_code]
        if websocket in self.connection_roles:
            del self.connection_roles[websocket]
        if self.session_technicians.get(session_code) == websocket:
            del self.session_technicians[session_code]
        if self.session_customers.get(session_code) == websocket:
            del self.session_customers[session_code]

    async def broadcast_to_session(self, message: str, session_code: str, sender: WebSocket = None):
        if session_code in self.active_connections:
            for connection in list(self.active_connections[session_code]):
                if connection != sender:
                    try:
                        await connection.send_text(message)
                    except Exception:
                        pass
                    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception:
            pass

manager = ConnectionManager()
