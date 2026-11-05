import sys
import os
import asyncio
backend_path = os.path.abspath(os.path.dirname(__file__))
sys.path.insert(0, backend_path)

from app.database.connection import db

async def promote(email: str):
    email = email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user:
        print(f"❌ User with email '{email}' not found.")
        print("Existing users in database:")
        all_users = await db.users.find({}, {"email": 1, "role": 1, "name": 1}).to_list(20)
        for u in all_users:
            print(f"  • {u.get('name')} <{u.get('email')}> - Role: {u.get('role')}")
        return

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"role": "admin"}})
    print(f"✅ Successfully promoted '{user.get('name')}' ({email}) to ADMIN role!")
    print("You can now log in at /login to access the full Admin Portal.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python promote_admin.py <email>")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))
