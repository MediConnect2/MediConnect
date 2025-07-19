from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
load_dotenv()

client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
db = client["mediconnect"]

patients_collection = db["patients"]
emt_collection = db["emt_users"]