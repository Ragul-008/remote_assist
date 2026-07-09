import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def test_conn():
    try:
        url = os.getenv("MONGODB_URL")
        print(f"Connecting to {url}...")
        client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
        db = client.remoteassist
        await db.users.find_one()
        print("Successfully connected!")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_conn())
