import asyncio
import websockets

async def test_ws():
    try:
        async with websockets.connect("ws://localhost:8000/ws/123456789?role=technician") as websocket:
            print("Connected successfully!")
            await websocket.close()
    except Exception as e:
        print(f"Failed: {e}")

asyncio.run(test_ws())
