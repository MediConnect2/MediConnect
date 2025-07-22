import os
from fastapi import Depends, FastAPI, HTTPException, Body, Header
from pydantic import BaseModel
from db import patients_collection,emt_collection
from utils.encryption import encrypt, decrypt
import bcrypt
import datetime
from datetime import timedelta
from typing import Optional
from jose import ExpiredSignatureError, jwt, JWTError

from dotenv import load_dotenv
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace "*" with your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ACCESS_TOKEN_EXPIRE_MINUTES = 30
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": datetime.datetime.now(datetime.timezone.utc)
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

#EMT Models

class RegisterEMT(BaseModel):
    username: str
    password: str
    first_name: str
    middle_name: str | None = None
    last_name: str

class LoginEMT(BaseModel):
    username: str
    password: str

@app.post("/emt/register")
async def register_emt(data: RegisterEMT):
    existing = await emt_collection.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=409, detail = "Username already exists")
    
    hashed_pw = bcrypt.hashpw(data.password.encode(),bcrypt.gensalt()).decode()

    doc = {
        "username": data.username,
        "hashed_password": hashed_pw,
        "first_name": encrypt(data.first_name),
        "middle_name": encrypt(data.middle_name or ""),
        "last_name": encrypt(data.last_name),
        "created_at": datetime.datetime.now(datetime.timezone.utc)
    }

    await emt_collection.insert_one(doc)
    return {"status": "success"}

@app.post("/emt/login")
async def login_emt(data: LoginEMT):
    emt = await emt_collection.find_one({"username":data.username})
    if not emt:
        raise HTTPException(status_code = 404, detail = "EMT not found")
    
    if not bcrypt.checkpw(data.password.encode(),emt['hashed_password'].encode()):
        raise HTTPException(status_code = 401, detail = "Invalid password")

    emt_info = {
        "first_name": decrypt(emt['first_name']['ciphertext'], emt['first_name']['nonce']),
        "middle_name": decrypt(emt['middle_name']['ciphertext'], emt['middle_name']['nonce']),
        "last_name": decrypt(emt['last_name']['ciphertext'], emt['last_name']['nonce']),
        "created_at": emt['created_at'].isoformat()
    }

    token_data = {
        "sub" : data.username,
        "role": "emt",
    }

    token = create_access_token(token_data)

    return {
        "emt_info": emt_info,
        "access_token": token
    }


#Patient Models
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

# Patient registration model
class RegisterPatient(BaseModel):
    mediconnect_username: str | None = None
    password: str | None = None
    first_name: str
    middle_name: str | None = None
    last_name: str
    driver_license_id: str | None = None
    portal_username: str
    portal_password: str
    provider_portal_name: str
    use_fingerprint: bool = False
    fingerprint_data: str | None = None

@app.post("/register")
async def register_patient(data: RegisterPatient):
    # Credential validation
    if not (
        (data.driver_license_id or data.mediconnect_username)
        and (data.password or data.driver_license_id)
    ):
        raise HTTPException(status_code=400, detail="Insufficient credentials provided")

    # Hash password
    hashed_pw = None
    if data.password:
        hashed_pw = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

    # Hash fingerprint data if provided
    fingerprint_hash = None
    if data.use_fingerprint and data.fingerprint_data:
        fingerprint_hash = bcrypt.hashpw(data.fingerprint_data.encode(), bcrypt.gensalt()).decode()

    # Encrypt fields
    encrypted_fields = {
        "first_name": encrypt(data.first_name),
        "middle_name": encrypt(data.middle_name or ""),
        "last_name": encrypt(data.last_name),
        "driver_license_id": encrypt(data.driver_license_id) if data.driver_license_id else None,
        "portal_username": encrypt(data.portal_username),
        "portal_password": encrypt(data.portal_password),
    }

    doc = {
        "mediconnect_username": data.mediconnect_username,
        "hashed_password": hashed_pw,
        "provider_portal_name": data.provider_portal_name,
        "use_fingerprint": data.use_fingerprint,
        "fingerprint_data": fingerprint_hash,
        "created_at": datetime.datetime.now(datetime.timezone.utc),
        **{k: v for k, v in encrypted_fields.items() if v is not None},
    }

    await patients_collection.insert_one(doc)
    return {"status": "success"}



class PatientLogin(BaseModel):
    mediconnect_username: Optional[str] = None
    password: Optional[str] = None

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    driver_license_id: Optional[str] = None

    fingerprint_data: Optional[str] = None


@app.post("/patient/login")
async def login_patient(data:PatientLogin):
    patients = patients_collection.find({})
    
    token_data = {
        "sub": patient["mediconnect_username"],
        "role": "patient"
    }
    token = create_access_token(token_data)

    # --- Fingerprint Authentication ---
    if data.fingerprint_data:
        async for patient in patients:
            if patients.get("use_fingerprint") and patient.get("fingerprint_data"):
                if bcrypt.checkpw(data.fingerprint_data.encode(), patient['fingerprint_data'].encode()):
                    return {
                        "patient_info": _build_patient_response(patient),
                        "access_token": token
                    }
        raise HTTPException(status_code = 404,detail = "Invalid fingerprint data")
    
    # --- MediConnect Login ---
    if data.mediconnect_username and data.password:
        async for patient in patients:
            if (patient["mediconnect_username"] == data.mediconnect_username):
                if bcrypt.checkpw(data.password.encode(),patient['hashed_password'].encode()):
                    return {
                        "patient_info": _build_patient_response(patient),
                        "access_token": token
                    }
                else:
                    raise HTTPException(status_code = 401, detail = "Invalid Password")
        raise HTTPException(status_code = 404, detail = "Patient not Found")
    
    # --- Driver License ID Login ---
    if data.first_name and data.last_name and data.driver_license_id:
        async for patient in patients:
            try:
                decrypted_fn = decrypt(patient['first_name']['ciphertext'], patient['first_name']['nonce'])
                decrypted_ln = decrypt(patient['last_name']['ciphertext'], patient['last_name']['nonce'])
                decrypted_dl = decrypt(patient['driver_license_id']['ciphertext'], patient['driver_license_id']['nonce'])
            except:
                continue
            
            if decrypted_fn == data.first_name and \
                decrypted_ln == data.last_name and \
                decrypted_dl == data.driver_license_id:
                return {
                    "patient_info": _build_patient_response(patient),
                    "access_token": token
                }
            raise HTTPException(status_code = 404, detail = "Patient not Found with Matching Details")
        
    # --- Missing Fields ---
    raise HTTPException(status_code = 400, detail = "Insufficient credentials. Provide either (1) MediConnect username and password, (2) name and driver license ID, or (3) fingerprint.")


def _build_patient_response(patient):
    return {
        "API": "true",  # Replace dynamically once hospital API detection is implemented
        "portal_name": patient["provider_portal_name"],
        "auth_username": decrypt(patient['portal_username']['ciphertext'], patient['portal_username']['nonce']),
        "auth_password": decrypt(patient['portal_password']['ciphertext'], patient['portal_password']['nonce']),
        "first_name": decrypt(patient['first_name']['ciphertext'], patient['first_name']['nonce']),
        "middle_name": decrypt(patient['middle_name']['ciphertext'], patient['middle_name']['nonce']),
        "last_name": decrypt(patient['last_name']['ciphertext'], patient['last_name']['nonce'])
    #replace with actual patient data once api integration is complete
    }



def verify_token(token:str):
    try:
        payload = jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code = 401, detail = "Token Expired")
    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid Token")
    
def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authentication header")
    token = authorization.split(" ")[1]
    return verify_token(token)

@app.get("/verify-token")
def verify_token_endpoint(current_user: dict = Depends(get_current_user)):
    return {"status": "ok", "user": current_user}