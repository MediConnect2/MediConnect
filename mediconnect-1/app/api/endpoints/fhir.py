from fastapi import APIRouter, HTTPException, Request
from app.services.fhir_service import FHIRService
from typing import Optional

router = APIRouter()
fhir_service = FHIRService()


def _get_token_entry(request: Request):
    session_id = request.session.get('session_id')
    token_store = getattr(request.app.state, "token_store", None)
    if not session_id or not isinstance(token_store, dict):
        return None
    return token_store.get(session_id)


def _resolve_auth(request: Request, require_patient_id: bool = True):
    entry = _get_token_entry(request)
    if not entry:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please login first via /login endpoint."
        )

    token = entry.get('token')
    if not isinstance(token, dict):
        raise HTTPException(status_code=401, detail="Session token is invalid. Please login again.")

    access_token = token.get('access_token')
    if not access_token:
        raise HTTPException(status_code=401, detail="Missing access token. Please login again.")

    patient_id = request.session.get('patient_id') or entry.get('patient_id')
    if require_patient_id and not patient_id:
        raise HTTPException(status_code=401, detail="No patient context available. Please login again.")

    return access_token, patient_id, entry

@router.get("/patient-info")
async def get_patient_info(request: Request):
    """
    Get comprehensive patient information from FHIR server.
    Requires an authenticated session with a valid access token.
    """
    access_token, patient_id, _ = _resolve_auth(request)
    
    try:
        # Fetch comprehensive patient data
        patient_data = await fhir_service.fetch_comprehensive_patient_data(patient_id, access_token)
        
        # Parse and format the data for EMT-friendly display
        formatted_data = {
            "patient_id": patient_id,
            "patient_name": fhir_service.parse_patient_name(patient_data["patient"]),
            "demographics": patient_data["patient"],
            "conditions": patient_data["conditions"],
            "allergies": {
                "summary": fhir_service.parse_allergies_summary(patient_data["allergies"]),
                "full_data": patient_data["allergies"]
            },
            "medications": {
                "summary": fhir_service.parse_medications_summary(patient_data["medications"]),
                "full_data": patient_data["medications"]
            },
            "vital_signs": patient_data["vital_signs"],
            "procedures": patient_data["procedures"],
            "immunizations": patient_data["immunizations"]
        }
        
        return formatted_data
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/patient/{patient_id}")
async def get_patient_by_id(patient_id: str, request: Request):
    """
    Get basic patient demographics by patient ID.
    Requires an authenticated session.
    """
    access_token, _, _ = _resolve_auth(request, require_patient_id=False)
    
    try:
        patient_data = await fhir_service.fetch_patient(patient_id, access_token)
        return patient_data
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/conditions")
async def get_patient_conditions(request: Request):
    """
    Get patient's medical conditions.
    """
    access_token, patient_id, _ = _resolve_auth(request)
    
    try:
        conditions = await fhir_service.fetch_conditions(patient_id, access_token)
        return conditions
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/allergies")
async def get_patient_allergies(request: Request):
    """
    Get patient's allergies and intolerances.
    Critical information for EMTs.
    """
    access_token, patient_id, _ = _resolve_auth(request)
    
    try:
        allergies = await fhir_service.fetch_allergies(patient_id, access_token)
        return {
            "summary": fhir_service.parse_allergies_summary(allergies),
            "full_data": allergies
        }
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/medications")
async def get_patient_medications(request: Request):
    """
    Get patient's current medications.
    """
    access_token, patient_id, _ = _resolve_auth(request)
    
    try:
        medications = await fhir_service.fetch_medications(patient_id, access_token)
        return {
            "summary": fhir_service.parse_medications_summary(medications),
            "full_data": medications
        }
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vital-signs")
async def get_patient_vital_signs(request: Request):
    """
    Get patient's vital signs observations.
    """
    access_token, patient_id, _ = _resolve_auth(request)
    
    try:
        vital_signs = await fhir_service.fetch_observations(patient_id, access_token, "vital-signs")
        return vital_signs
    except HTTPException as exc:
        raise exc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/procedures")
async def get_patient_procedures(request: Request):
    """
    Get patient's procedure history.
    """
    access_token, patient_id, _ = _resolve_auth(request)
    
    try:
        procedures = await fhir_service.fetch_procedures(patient_id, access_token)
        return procedures
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))