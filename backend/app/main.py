from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.auth import router as auth_router
from app.api.session import router as session_router
from app.api.ws import router as ws_router
from app.api.user import router as user_router

app = FastAPI(title="RemoteAssist API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"], # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(user_router, prefix="/api/users", tags=["users"])
app.include_router(session_router, prefix="/api/sessions", tags=["sessions"])
app.include_router(ws_router, tags=["websocket"])

@app.get("/")
def root():
    return {"message": "Welcome to RemoteAssist API"}
