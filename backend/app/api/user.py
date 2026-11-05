from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.connection import get_database
from app.schemas.user import UserResponse, UserUpdate, UserRoleUpdate
from app.auth.dependencies import get_current_active_user, get_current_admin, get_current_technician
from app.database.audit import record_audit_log
from bson.objectid import ObjectId

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_active_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Standard users cannot change their own role
    update_data = {k: v for k, v in user_update.model_dump(exclude_unset=True).items() if v is not None and k != "role"}
    
    if not update_data:
        return current_user
        
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"_id": ObjectId(current_user["id"])})
    if updated_user:
        updated_user["id"] = str(updated_user["_id"])
        return updated_user
    raise HTTPException(status_code=404, detail="User not found")

@router.get("/", response_model=list[UserResponse])
async def list_users(
    role: str = None,
    current_user: dict = Depends(get_current_technician),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    query = {}
    if role and role != "all":
        query["role"] = role
        
    users = await db.users.find(query).sort("created_at", -1).to_list(length=200)
    result = []
    for u in users:
        u["id"] = str(u["_id"])
        result.append(u)
    return result

@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: str,
    role_update: UserRoleUpdate,
    current_user: dict = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    target_user = await db.users.find_one({"_id": obj_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    updates = {"role": role_update.role}
    if role_update.is_active is not None:
        updates["is_active"] = role_update.is_active
        
    await db.users.update_one({"_id": obj_id}, {"$set": updates})
    
    await record_audit_log(
        db,
        action="user_role_updated",
        details=f"User '{target_user.get('email')}' role updated to {role_update.role} by admin {current_user.get('name')}",
        user=current_user
    )
    
    updated = await db.users.find_one({"_id": obj_id})
    updated["id"] = str(updated["_id"])
    return updated

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
        
    target_user = await db.users.find_one({"_id": obj_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await db.users.delete_one({"_id": obj_id})
    
    await record_audit_log(
        db,
        action="user_deleted",
        details=f"User '{target_user.get('email')}' deleted by admin {current_user.get('name')}",
        user=current_user
    )
    
    return {"message": "User deleted successfully"}

