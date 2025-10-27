import os
from fastapi import Depends, FastAPI, HTTPException, Body, Header, Query
from pydantic import BaseModel
from db import patients_collection,emt_collection,hospitals_collection
from utils.encryption import encrypt, decrypt
import bcrypt
import datetime
from datetime import timedelta
from typing import Optional
from jose import ExpiredSignatureError, jwt, JWTError
from starlette.requests import Request
from starlette.responses import RedirectResponse
import secrets
import logging
import re

# Import FHIR modules
from fhir_service import FHIRService
from fhir_oauth import FHIROAuthHandler

from dotenv import load_dotenv
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()

# Setup logging
logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"

# Initialize FHIR services
fhir_service = FHIRService()
fhir_oauth = FHIROAuthHandler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
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
    mediconnect_username: str
    password: str
    first_name: str
    middle_name: str | None = None
    last_name: str
    driver_license_id: str
    use_fingerprint: bool = False
    fingerprint_data: str | None = None

@app.post("/register")
async def register_patient(data: RegisterPatient):
    # Check if MediConnect username already exists
    existing_patient = await patients_collection.find_one({"mediconnect_username": data.mediconnect_username})
    if existing_patient:
        raise HTTPException(status_code=409, detail=f"Username '{data.mediconnect_username}' is already taken")

    # Hash password
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
        "driver_license_id": encrypt(data.driver_license_id),
    }

    # Generate session ID for FHIR OAuth flow
    session_id = f"reg_{data.mediconnect_username}_{secrets.token_urlsafe(16)}"

    doc = {
        "mediconnect_username": data.mediconnect_username,
        "hashed_password": hashed_pw,
        "use_fingerprint": data.use_fingerprint,
        "fingerprint_data": fingerprint_hash,
        "created_at": datetime.datetime.now(datetime.timezone.utc),
        "registration_status": "pending_fhir",  # Status: pending_fhir, completed, or skipped_fhir
        "fhir_session_id": session_id,
        "fhir_connected": False,
        **encrypted_fields,
    }

    await patients_collection.insert_one(doc)
    return {
        "status": "success", 
        "message": "Patient account created. Please connect healthcare provider.",
        "session_id": session_id
    }



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
    


    # --- Fingerprint Authentication ---
    if data.fingerprint_data:
        async for patient in patients:
            if patient.get("use_fingerprint") and patient.get("fingerprint_data"):
                if bcrypt.checkpw(data.fingerprint_data.encode(), patient['fingerprint_data'].encode()):
                    token_data = {
                        "sub": patient["mediconnect_username"],
                        "role": "patient"
                    }
                    token = create_access_token(token_data)
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
                    token_data = {
                        "sub": patient["mediconnect_username"],
                        "role": "patient"
                    }
                    token = create_access_token(token_data)
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
                token_data = {
                        "sub": patient["mediconnect_username"],
                        "role": "patient"
                    }
                token = create_access_token(token_data)
                return {
                    "patient_info": _build_patient_response(patient),
                    "access_token": token
                }
            raise HTTPException(status_code = 404, detail = "Patient not Found with Matching Details")
        
    # --- Missing Fields ---
    raise HTTPException(status_code = 400, detail = "Insufficient credentials. Provide either (1) MediConnect username and password, (2) name and driver license ID, or (3) fingerprint.")


class DeletePatientRequest(BaseModel):
    mediconnect_username: str
    mediconnect_password: str
    driver_license_id: str
    delete_prompt: str


@app.post("/patient/delete")
async def deletePatient(data: DeletePatientRequest):
    patients = patients_collection.find({})
    async for patient in patients:
        if patient['mediconnect_username'] == data.mediconnect_username:
            if bcrypt.checkpw(data.mediconnect_password.encode(), patient['hashed_password'].encode()):
                decrypted_dl = decrypt(patient['driver_license_id']['ciphertext'], patient['driver_license_id']['nonce'])
                if decrypted_dl == data.driver_license_id:
                    if data.delete_prompt == "DELETE ACCOUNT":
                        patients_collection.delete_one({"_id": patient["_id"]})
                        return {"detail": "Patient record deleted successfully"}
                    else:
                        raise HTTPException(status_code=400, detail="Invalid delete prompt.")
    raise HTTPException(status_code=404, detail="Credentials Incorrect")

def _build_patient_response(patient):
    """Build patient response with FHIR data if available"""
    response = {
        "first_name": decrypt(patient['first_name']['ciphertext'], patient['first_name']['nonce']),
        "middle_name": decrypt(patient['middle_name']['ciphertext'], patient['middle_name']['nonce']),
        "last_name": decrypt(patient['last_name']['ciphertext'], patient['last_name']['nonce']),
        "fhir_connected": patient.get("fhir_connected", False)
    }
    
    # Add FHIR data if connected
    if patient.get("fhir_connected") and patient.get("fhir_data"):
        response["API"] = "true"
        response["portal_name"] = patient.get("provider_name", "Unknown Provider")
        response["fhir_patient_id"] = patient.get("fhir_patient_id")
        response["fhir_last_updated"] = patient.get("fhir_last_updated").isoformat() if patient.get("fhir_last_updated") else None
        
        # Include summary of available FHIR data
        fhir_data = patient.get("fhir_data", {})

        # Helper to count manually-entered items (split on comma, newline, or semicolon)
        def _count_manual_items(decrypted_value: str | None) -> int:
            if not decrypted_value:
                return 0
            parts = [p.strip() for p in re.split(r"[,\n;]+", decrypted_value) if p.strip()]
            return len(parts)

        response["medical_data_summary"] = {
            "allergies_count": max(0, len(fhir_data.get("allergies", {}).get("entry", [])) + _count_manual_items(response.get("manual_allergies")) - 1),
            "conditions_count": len(fhir_data.get("conditions", {}).get("entry", [])) + _count_manual_items(response.get("manual_conditions")),
            "medications_count": len(fhir_data.get("medications", {}).get("entry", [])) + _count_manual_items(response.get("manual_medications")),
            "observations_count": len(fhir_data.get("observations", {}).get("entry", [])),
            "procedures_count": len(fhir_data.get("procedures", {}).get("entry", [])) + _count_manual_items(response.get("manual_procedures")),
            "immunizations_count": len(fhir_data.get("immunizations", {}).get("entry", [])) + _count_manual_items(response.get("manual_immunizations")),
            # Track which ones have manual data
            "has_manual_allergies": bool(response.get("manual_allergies")),
            "has_manual_conditions": bool(response.get("manual_conditions")),
            "has_manual_medications": bool(response.get("manual_medications")),
            "has_manual_procedures": bool(response.get("manual_procedures")),
            "has_manual_immunizations": bool(response.get("manual_immunizations"))
        }
    else:
        # Legacy fields for non-FHIR patients (if they exist)
        if patient.get("portal_username") and patient.get("portal_password"):
            response["API"] = "false"  # Legacy portal credentials
            response["portal_name"] = patient.get("provider_portal_name", "Unknown")
            response["auth_username"] = decrypt(patient['portal_username']['ciphertext'], patient['portal_username']['nonce'])
            response["auth_password"] = decrypt(patient['portal_password']['ciphertext'], patient['portal_password']['nonce'])
        else:
            response["API"] = "false"
            response["portal_name"] = "Not Connected"
    
    return response





# Hospital Username and Password Check Model
class HospitalUsernamePasswordCheck(BaseModel):
    username: str
    password: str
    name:str | None = None

@app.post("/hospital/login")
async def check_hospital_credentials(data: HospitalUsernamePasswordCheck):
    hospitals = hospitals_collection.find({})
    if data.username and data.password:
        async for hospital in hospitals:
            if (hospital['username'] == data.username):
                if bcrypt.checkpw(data.password.encode(),hospital['hashed_password'].encode()):
                    token_data = {
                        "sub":hospital['username'],
                        "role":"hospital"
                    }
                    token = create_access_token(token_data)
                    return {
                        "name": hospital.get('name', hospital['username']),
                        "access_token": token
                    }
                else:
                    raise HTTPException(status_code = 401, detail = "Invalid Password")
        raise HTTPException(status_code = 404, detail = "Hospital not Found")


class PatientAccessCredentials(BaseModel):
    mediconnect_username: str
    password: str
    driver_license_id: str

@app.post("/check-patient-access")
async def check_patient_access_credentials(data: PatientAccessCredentials):
    patients = patients_collection.find({})
    
    if data.mediconnect_username and data.password and data.driver_license_id:
        async for patient in patients:
            if (patient['mediconnect_username'] == data.mediconnect_username):
                if bcrypt.checkpw(data.password.encode(), patient['hashed_password'].encode()):
                    decrypted_dl = decrypt(patient['driver_license_id']['ciphertext'], patient['driver_license_id']['nonce'])
                    
                    if (decrypted_dl == data.driver_license_id):
                        return {"status": "success", "message": "Patient access verified"}
        raise HTTPException(status_code = 404, detail = "Patient not Found")
    else: raise HTTPException(status_code = 400, detail = "Insufficient Credentials Provided.")
# Token Verification and User Retrieval
def verify_token(token:str):
    try:
        payload = jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code = 401, detail = "Token Expired")
    except JWTError:
        raise HTTPException(status_code = 401, detail = "Invalid Token")
    
# def get_current_user(authorization: str = Header(...)):
#     if not authorization.startswith("Bearer "):
#         raise HTTPException(status_code=401, detail="Invalid authentication header")
#     token = authorization.split(" ")[1]
#     return verify_token(token)

def get_current_emt(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail = "Invalid authentication header")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if payload.get("role") !="emt":
        raise HTTPException(status_code = 403, detail="EMT access required")
    return payload

def get_current_hospital(authorization:str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail = "Invalid authentication header")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if payload.get("role") != "hospital":
        raise HTTPException(status_code=403, detail="Hospital access required")
    return payload

def get_current_patient(authorization:str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail = "Invalid authentication header")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if payload.get("role") != "patient":
        raise HTTPException(status_code=403, detail = "Patient access required")
    return payload



@app.get("/verify-emt-token")
def verify_emt_token_endpoint(current_emt: dict = Depends(get_current_emt)):
    return {"status": "ok", "user": current_emt}

@app.get("/verify-hospital-token")
def verify_hospital_token_endpoint(current_hospital: dict = Depends(get_current_hospital)):
    return {"status": "ok", "user": current_hospital}

@app.get("/verify-patient-token")
def verify_patient_token_endpoint(current_patient: dict = Depends(get_current_patient)):
    return {"status": "ok", "user": current_patient}


# ==================== FHIR ENDPOINTS ====================

class FHIRLoginRequest(BaseModel):
    """Request model for initiating FHIR OAuth login"""
    patient_username: str  # MediConnect username to link FHIR data to

@app.post("/fhir-login")
async def initiate_fhir_login(request: Request, data: FHIRLoginRequest):
    """
    Initiate FHIR OAuth login flow for a patient
    
    This endpoint starts the OAuth2 authorization code flow with Epic FHIR.
    The patient will be redirected to Epic's patient portal (MyChart) to authenticate.
    
    Flow:
    1. Patient calls this endpoint with their MediConnect username
    2. System generates a session ID and initiates OAuth flow
    3. Patient is redirected to Epic login
    4. After Epic login, patient is redirected back to /fhir-callback
    5. System exchanges authorization code for access token
    6. FHIR data can then be fetched using the session ID
    """
    # Generate unique session ID for this OAuth flow
    session_id = f"fhir_{data.patient_username}_{secrets.token_urlsafe(16)}"
    
    # Initiate OAuth flow
    redirect_response = fhir_oauth.initiate_patient_login(request, session_id)
    
    return {
        "status": "redirect_required",
        "session_id": session_id,
        "redirect_url": redirect_response.headers["location"],
        "message": "Redirect patient to this URL to complete Epic authentication"
    }

@app.get("/callback")
async def fhir_callback(
    code: str = Query(..., description="Authorization code from Epic"),
    state: str = Query(..., description="State parameter for CSRF validation")
):
    """
    OAuth callback endpoint - Epic redirects here after patient authentication
    
    This endpoint:
    1. Validates the state parameter (CSRF protection)
    2. Exchanges authorization code for access token
    3. Stores the access token and patient ID
    4. Redirects to frontend callback page to complete the flow
    
    Note: The state parameter IS the session_id - we use it to retrieve the stored session data
    """
    try:
        # Exchange code for token (only pass code and state)
        token_data = await fhir_oauth.handle_callback(code, state)
        
        session_id = token_data.get("session_id", state)
        patient_id = token_data.get("patient_id")
        
        logger.info(f"✅ OAuth callback successful | Redirecting to frontend | session={session_id} | patient={patient_id}")
        
        # Redirect to frontend callback page with session_id
        # Frontend will handle the UI and call /patient/link-fhir
        frontend_callback_url = f"http://localhost:3000/callback?session_id={session_id}&patient_id={patient_id}&status=success"
        
        return RedirectResponse(url=frontend_callback_url, status_code=302)
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Callback processing failed: {str(e)}")

class FHIRDataRequest(BaseModel):
    """Request model for fetching FHIR patient data"""
    session_id: str
    patient_id: Optional[str] = None  # If not provided, uses patient_id from token

@app.post("/fhir-request")
async def fetch_fhir_data(data: FHIRDataRequest):
    """
    Fetch comprehensive patient FHIR data using stored access token
    
    This is the main endpoint for retrieving patient medical records from Epic FHIR.
    
    Args:
        session_id: Session ID from the OAuth login flow
        patient_id: Optional override for patient ID (uses token's patient_id if not provided)
    
    Returns:
        Comprehensive patient data including:
        - Demographics (name, DOB, gender, contact info)
        - Allergies and intolerances
        - Medical conditions
        - Medications
        - Observations (vital signs, lab results, social history)
        - Procedures
        - Immunizations
    
    Note: Some resources may return 403 if Epic's patient portal restricts access.
    The endpoint gracefully handles these errors and returns available data.
    """
    # Retrieve stored token
    token_data = fhir_oauth.get_token(data.session_id)
    
    if not token_data:
        raise HTTPException(
            status_code=401,
            detail="Session expired or invalid. Please re-authenticate via /fhir-login"
        )
    
    access_token = token_data.get("access_token")
    patient_id = data.patient_id or token_data.get("patient_id")
    
    if not patient_id:
        raise HTTPException(
            status_code=400,
            detail="No patient ID available. Ensure OAuth flow completed successfully."
        )
    
    try:
        # Fetch comprehensive patient data
        patient_data = await fhir_service.fetch_comprehensive_patient_data(
            patient_id=patient_id,
            access_token=access_token
        )
        
        return {
            "status": "success",
            "session_id": data.session_id,
            "data": patient_data
        }
        
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch FHIR data: {str(e)}"
        )

@app.post("/fhir-logout")
async def fhir_logout(session_id: str = Body(..., embed=True)):
    """
    Clear FHIR session and token data
    
    Args:
        session_id: Session ID to clear
    
    Returns:
        Success confirmation
    """
    fhir_oauth.clear_token(session_id)
    
    return {
        "status": "success",
        "message": "FHIR session cleared"
    }

class PatientLinkFHIRRequest(BaseModel):
    """Request model for linking FHIR data to patient record"""
    mediconnect_username: str
    fhir_session_id: str

@app.post("/patient/link-fhir")
async def link_fhir_to_patient(data: PatientLinkFHIRRequest):
    """
    Link FHIR data to patient record after successful OAuth
    
    This endpoint:
    1. Fetches comprehensive FHIR data using the session ID
    2. Stores the FHIR data in the patient's MongoDB record
    3. Updates the registration status to completed
    
    Args:
        mediconnect_username: The patient's MediConnect username
        fhir_session_id: Session ID from the FHIR OAuth flow
    
    Returns:
        Success confirmation with patient data summary
    """
    # Find the patient record
    patient = await patients_collection.find_one({"mediconnect_username": data.mediconnect_username})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Retrieve FHIR token
    token_data = fhir_oauth.get_token(data.fhir_session_id)
    if not token_data:
        raise HTTPException(
            status_code=401,
            detail="FHIR session expired or invalid. Please re-authenticate."
        )
    
    access_token = token_data.get("access_token")
    patient_id = token_data.get("patient_id")
    
    if not patient_id:
        raise HTTPException(status_code=400, detail="No patient ID available from FHIR session")
    
    try:
        # Fetch comprehensive patient data from FHIR
        fhir_data = await fhir_service.fetch_comprehensive_patient_data(
            patient_id=patient_id,
            access_token=access_token
        )
        
        # Extract provider name from FHIR patient data if available
        provider_name = "Unknown Provider"
        if fhir_data.get("patient") and fhir_data["patient"].get("managingOrganization"):
            provider_name = fhir_data["patient"]["managingOrganization"].get("display", "Unknown Provider")
        
        # Update patient record with FHIR data
        update_result = await patients_collection.update_one(
            {"mediconnect_username": data.mediconnect_username},
            {
                "$set": {
                    "fhir_patient_id": patient_id,
                    "fhir_data": fhir_data,
                    "fhir_last_updated": datetime.datetime.now(datetime.timezone.utc),
                    "fhir_connected": True,
                    "registration_status": "completed",
                    "provider_name": provider_name,
                    "fhir_scope": token_data.get("scope", "")
                }
            }
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update patient record")
        
        # Clear the FHIR session token (optional - keep if you want to reuse it)
        # fhir_oauth.clear_token(data.fhir_session_id)
        
        return {
            "status": "success",
            "message": "FHIR data successfully linked to patient account",
            "provider_name": provider_name,
            "patient_id": patient_id,
            "data_summary": {
                "demographics": bool(fhir_data.get("patient")),
                "allergies": len(fhir_data.get("allergies", {}).get("entry", [])),
                "conditions": len(fhir_data.get("conditions", {}).get("entry", [])),
                "medications": len(fhir_data.get("medications", {}).get("entry", [])),
                "observations": len(fhir_data.get("observations", {}).get("entry", [])),
                "procedures": len(fhir_data.get("procedures", {}).get("entry", [])),
                "immunizations": len(fhir_data.get("immunizations", {}).get("entry", []))
            }
        }
        
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch or store FHIR data: {str(e)}"
        )

class PatientSkipFHIRRequest(BaseModel):
    """Request model for skipping FHIR connection"""
    mediconnect_username: str

@app.post("/patient/skip-fhir")
async def skip_fhir_connection(data: PatientSkipFHIRRequest):
    """
    Skip FHIR connection and complete registration
    
    Allows patients to complete registration without connecting their healthcare provider.
    They can connect later from their profile.
    
    Args:
        mediconnect_username: The patient's MediConnect username
    
    Returns:
        Success confirmation
    """
    # Find the patient record
    patient = await patients_collection.find_one({"mediconnect_username": data.mediconnect_username})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Update registration status
    update_result = await patients_collection.update_one(
        {"mediconnect_username": data.mediconnect_username},
        {
            "$set": {
                "registration_status": "skipped_fhir",
                "fhir_connected": False
            }
        }
    )
    
    if update_result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to update patient record")
    
    return {
        "status": "success",
        "message": "Registration completed without FHIR connection. You can connect your healthcare provider later."
    }

class FHIRResourceRequest(BaseModel):
    """Request model for fetching specific FHIR resources"""
    session_id: str
    patient_id: Optional[str] = None
    resource_type: str  # "allergies", "conditions", "medications", "observations", "procedures", "immunizations"
    category: Optional[str] = None  # For observations: "vital-signs", "laboratory", "social-history"

@app.post("/fhir-resource")
async def fetch_fhir_resource(data: FHIRResourceRequest):
    """
    Fetch a specific FHIR resource type
    
    Useful for fetching individual resource types instead of all comprehensive data.
    
    Resource types:
    - "patient": Demographics
    - "allergies": Allergies and intolerances
    - "conditions": Medical conditions
    - "medications": Medication requests
    - "observations": Observations (requires category)
    - "procedures": Procedure history
    - "immunizations": Immunization records
    """
    # Retrieve stored token
    token_data = fhir_oauth.get_token(data.session_id)
    
    if not token_data:
        raise HTTPException(status_code=401, detail="Session expired. Please re-authenticate.")
    
    access_token = token_data.get("access_token")
    patient_id = data.patient_id or token_data.get("patient_id")
    
    if not patient_id:
        raise HTTPException(status_code=400, detail="No patient ID available")
    
    try:
        # Route to appropriate FHIR service method
        if data.resource_type == "patient":
            result = await fhir_service.fetch_patient(patient_id, access_token)
        elif data.resource_type == "allergies":
            result = await fhir_service.fetch_allergies(patient_id, access_token)
        elif data.resource_type == "conditions":
            result = await fhir_service.fetch_conditions(patient_id, access_token)
        elif data.resource_type == "medications":
            result = await fhir_service.fetch_medications(patient_id, access_token)
        elif data.resource_type == "observations":
            result = await fhir_service.fetch_observations(patient_id, access_token, data.category)
        elif data.resource_type == "procedures":
            result = await fhir_service.fetch_procedures(patient_id, access_token)
        elif data.resource_type == "immunizations":
            result = await fhir_service.fetch_immunizations(patient_id, access_token)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown resource type: {data.resource_type}")
        
        return {
            "status": "success",
            "resource_type": data.resource_type,
            "data": result
        }
        
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch {data.resource_type}: {str(e)}")


# ==================== PATIENT PROFILE ENDPOINTS ====================

class UpdateProfileRequest(BaseModel):
    """Request model for updating patient profile"""
    mediconnect_username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    date_of_birth: Optional[str] = None
    blood_type: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    # Manually inputted health data
    allergies: Optional[str] = None
    conditions: Optional[str] = None
    medications: Optional[str] = None
    procedures: Optional[str] = None
    immunizations: Optional[str] = None

@app.post("/patient/update-profile")
async def update_patient_profile(data: UpdateProfileRequest):
    """
    Update patient profile with additional information
    
    This endpoint allows patients to add or update contact info,
    emergency contacts, address, and insurance information.
    """
    # Find the patient record
    patient = await patients_collection.find_one({"mediconnect_username": data.mediconnect_username})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Prepare update data - encrypt sensitive fields
    update_data = {}
    
    # Encrypt contact information if provided
    if data.email:
        update_data["email"] = encrypt(data.email)
    if data.phone:
        update_data["phone"] = encrypt(data.phone)
    if data.emergency_contact_name:
        update_data["emergency_contact_name"] = encrypt(data.emergency_contact_name)
    if data.emergency_contact_phone:
        update_data["emergency_contact_phone"] = encrypt(data.emergency_contact_phone)
    
    # Encrypt address information if provided
    if data.address_line1:
        update_data["address_line1"] = encrypt(data.address_line1)
    if data.address_line2:
        update_data["address_line2"] = encrypt(data.address_line2)
    if data.city:
        update_data["city"] = encrypt(data.city)
    if data.state:
        update_data["state"] = encrypt(data.state)
    if data.zip_code:
        update_data["zip_code"] = encrypt(data.zip_code)
    
    # Encrypt medical information if provided
    if data.date_of_birth:
        update_data["date_of_birth"] = encrypt(data.date_of_birth)
    if data.blood_type:
        update_data["blood_type"] = encrypt(data.blood_type)
    
    # Encrypt insurance information if provided
    if data.insurance_provider:
        update_data["insurance_provider"] = encrypt(data.insurance_provider)
    if data.insurance_policy_number:
        update_data["insurance_policy_number"] = encrypt(data.insurance_policy_number)
    
    # Store manually inputted health data (encrypted)
    if data.allergies:
        update_data["manual_allergies"] = encrypt(data.allergies)
    if data.conditions:
        update_data["manual_conditions"] = encrypt(data.conditions)
    if data.medications:
        update_data["manual_medications"] = encrypt(data.medications)
    if data.procedures:
        update_data["manual_procedures"] = encrypt(data.procedures)
    if data.immunizations:
        update_data["manual_immunizations"] = encrypt(data.immunizations)
    
    # Mark profile as complete
    update_data["profile_completed"] = True
    update_data["profile_updated_at"] = datetime.datetime.now(datetime.timezone.utc)
    
    # Update patient record
    update_result = await patients_collection.update_one(
        {"mediconnect_username": data.mediconnect_username},
        {"$set": update_data}
    )
    
    if update_result.modified_count == 0 and not update_data:
        return {"status": "success", "message": "No changes to update"}
    
    return {
        "status": "success",
        "message": "Profile updated successfully"
    }

@app.get("/patient/profile/{username}")
async def get_patient_profile(username: str):
    """
    Get patient profile data (decrypted)
    
    Returns all patient information including FHIR data if connected
    """
    # Find the patient record
    patient = await patients_collection.find_one({"mediconnect_username": username})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Build response with decrypted data
    response = {
        "mediconnect_username": username,
        "first_name": decrypt(patient['first_name']['ciphertext'], patient['first_name']['nonce']),
        "middle_name": decrypt(patient['middle_name']['ciphertext'], patient['middle_name']['nonce']),
        "last_name": decrypt(patient['last_name']['ciphertext'], patient['last_name']['nonce']),
        "driver_license_id": decrypt(patient['driver_license_id']['ciphertext'], patient['driver_license_id']['nonce']),
        "fhir_connected": patient.get("fhir_connected", False),
        "profile_completed": patient.get("profile_completed", False)
    }
    
    # Add optional encrypted fields if they exist
    optional_fields = [
        'email', 'phone', 'emergency_contact_name', 'emergency_contact_phone',
        'address_line1', 'address_line2', 'city', 'state', 'zip_code',
        'date_of_birth', 'blood_type', 'insurance_provider', 'insurance_policy_number',
        'manual_allergies', 'manual_conditions', 'manual_medications', 
        'manual_procedures', 'manual_immunizations'
    ]
    
    for field in optional_fields:
        if field in patient and patient[field]:
            try:
                response[field] = decrypt(patient[field]['ciphertext'], patient[field]['nonce'])
            except:
                response[field] = None
    
    # Add FHIR information if connected
    if patient.get("fhir_connected"):
        response["provider_name"] = patient.get("provider_name", "Unknown Provider")
        response["fhir_patient_id"] = patient.get("fhir_patient_id")
        response["fhir_last_updated"] = patient.get("fhir_last_updated").isoformat() if patient.get("fhir_last_updated") else None
        
        # Include FHIR data summary
        if patient.get("fhir_data"):
            fhir_data = patient.get("fhir_data", {})
            response["fhir_data"] = fhir_data

            # Helper to count manually-entered items (split on comma, newline, or semicolon)
            def _count_manual_items(decrypted_value: str | None) -> int:
                if not decrypted_value:
                    return 0
                parts = [p.strip() for p in re.split(r"[,\n;]+", decrypted_value) if p.strip()]
                return len(parts)

            response["medical_data_summary"] = {
                "allergies_count": max(0, len(fhir_data.get("allergies", {}).get("entry", [])) + _count_manual_items(response.get("manual_allergies")) - 1),
                "conditions_count": len(fhir_data.get("conditions", {}).get("entry", [])) + _count_manual_items(response.get("manual_conditions")),
                "medications_count": len(fhir_data.get("medications", {}).get("entry", [])) + _count_manual_items(response.get("manual_medications")),
                "observations_count": len(fhir_data.get("observations", {}).get("entry", [])),
                "procedures_count": len(fhir_data.get("procedures", {}).get("entry", [])) + _count_manual_items(response.get("manual_procedures")),
                "immunizations_count": len(fhir_data.get("immunizations", {}).get("entry", [])) + _count_manual_items(response.get("manual_immunizations")),
                # Track which ones have manual data
                "has_manual_allergies": bool(response.get("manual_allergies")),
                "has_manual_conditions": bool(response.get("manual_conditions")),
                "has_manual_medications": bool(response.get("manual_medications")),
                "has_manual_procedures": bool(response.get("manual_procedures")),
                "has_manual_immunizations": bool(response.get("manual_immunizations"))
            }
    else:
        # If not connected to FHIR, compute counts from manually reported (decrypted) data
        def _count_manual_items_no_fhir(decrypted_value: str | None) -> int:
            if not decrypted_value:
                return 0
            parts = [p.strip() for p in re.split(r"[,\n;]+", decrypted_value) if p.strip()]
            return len(parts)

        response["medical_data_summary"] = {
            "allergies_count": max(0, _count_manual_items_no_fhir(response.get("manual_allergies")) - 1),
            "conditions_count": _count_manual_items_no_fhir(response.get("manual_conditions")),
            "medications_count": _count_manual_items_no_fhir(response.get("manual_medications")),
            "observations_count": 0,
            "procedures_count": _count_manual_items_no_fhir(response.get("manual_procedures")),
            "immunizations_count": _count_manual_items_no_fhir(response.get("manual_immunizations")),
            # Track which ones have manual data
            "has_manual_allergies": bool(response.get("manual_allergies")),
            "has_manual_conditions": bool(response.get("manual_conditions")),
            "has_manual_medications": bool(response.get("manual_medications")),
            "has_manual_procedures": bool(response.get("manual_procedures")),
            "has_manual_immunizations": bool(response.get("manual_immunizations"))
        }
    
    return response
