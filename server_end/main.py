from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from db import patients_collection,emt_collection
from utils.encryption import encrypt, decrypt
import bcrypt
import datetime


app = FastAPI()

#Models

class RegisterPatient(BaseModel):
    mediconnect_username:str
    password:str
    first_name:str
    middle_name:str | None = None
    last_name:str
    driver_license_id: str
    portal_username:str
    portal_password:str
    provider_portal_name:str
    use_fingerprint: bool = False
    fingerprint_data: str | None = None

@app.post("/register")
async def register_patient(data: RegisterPatient):
    hashed_pw = bcrypt.hashpw(data.password.encode(),bcrypt.gensalt()).decode()
    fingerprint_hash = None
    if data.use_fingerprint and data.fingerprint_data:
        fingerprint_hash = bcrypt.hashpw(data.fingerprint_data.encode(),bcrypt.gensalt()).decode()

    encrypted_fields = {
        "first_name": encrypt(data.first_name),
        "middle_name":encrypt(data.middle_name or ""),
        "last_name":encrypt(data.last_name),
        "driver_license_id": encrypt(data.driver_license_id),
        "portal_username": encrypt(data.portal_username),
        "portal_password": encrypt(data.portal_password)
    }
    doc = {
        "mediconnect_username": data.mediconnect_username,
        "hashed_password": hashed_pw,
        "provider_portal_name": data.provider_portal_name,
        "use_fingerprint": data.use_fingerprint,
        "fingerprint_data": fingerprint_hash,
        "created_at": datetime.datetime.now(datetime.timezone.utc),
        **encrypted_fields
    }

    await patients_collection.insert_one(doc)
    return{"status":"success"}

class PatientQuery(BaseModel):
    driver_license_id:str
    password:str


@app.post("/lookup")
async def lookup_patient(query:PatientQuery):
    patients = patients_collection.find({})
    async for patient in patients:
        #Decrypt and match driver license ID
        try:
            license_id = decrypt(patient['driver_license_id']['ciphertext'], patient['driver_license_id']['nonce'])
        except:
            continue
        if license_id == query.driver_license_id:
            #verify password
            if bcrypt.checkpw(query.password.encode(),patient['hashed_password'].encode()):
                #Build response
                portal_info = {
                    "API": "true",  # Replace dynamically once hospital API detection is implemented
                    "portal_name": patient["provider_portal_name"],
                    "auth_username": decrypt(patient['portal_username']['ciphertext'], patient['portal_username']['nonce']),
                    "auth_password": decrypt(patient['portal_password']['ciphertext'], patient['portal_password']['nonce']),
                    "first_name": decrypt(patient['first_name']['ciphertext'], patient['first_name']['nonce']),
                    "middle_name": decrypt(patient['middle_name']['ciphertext'], patient['middle_name']['nonce']),
                    "last_name": decrypt(patient['last_name']['ciphertext'], patient['last_name']['nonce'])
                }
                return portal_info
            else: raise HTTPException(status_code = 401, detail = "Invalid password")
    raise HTTPException(status_code = 404, detail = "Patient not found")