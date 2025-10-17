from fastapi import APIRouter, HTTPException, Request, Query
from typing import List, Optional
from app.models.patient import Patient, PatientSearchResult
from app.services.fhir_service import FHIRService

router = APIRouter()
fhir_service = FHIRService()


def _get_token_entry(request: Request):
    session_id = request.session.get('session_id')
    token_store = getattr(request.app.state, "token_store", None)
    if not session_id or not isinstance(token_store, dict):
        return None
    return token_store.get(session_id)

@router.get("/search-patient")
async def search_patient(
    request: Request,
    name: Optional[str] = Query(None, description="Patient name to search"),
    birthdate: Optional[str] = Query(None, description="Patient birth date (YYYY-MM-DD)"),
    identifier: Optional[str] = Query(None, description="Patient identifier (e.g., MRN)")
):
    """
    Search for patients by name, birth date, or identifier.
    This endpoint is useful for EMTs who need to find a patient's ID to access their records.
    
    Note: In production, this would query the FHIR server's Patient search endpoint.
    For now, this is a placeholder that would need proper implementation.
    """
    token_entry = _get_token_entry(request)
    
    if not token_entry:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Please login first."
        )
    
    # This is a placeholder implementation
    # In production, you would make a FHIR API call like:
    # GET {base_url}/Patient?name={name}&birthdate={birthdate}
    
    return {
        "message": "Patient search functionality - to be implemented with actual FHIR search",
        "search_params": {
            "name": name,
            "birthdate": birthdate,
            "identifier": identifier
        },
        "note": "In a real implementation, this would query the FHIR server and return matching patients"
    }

@router.get("/current-patient")
async def get_current_patient(request: Request):
    """
    Get information about the currently authenticated patient context.
    Returns the patient ID from the session.
    """
    patient_id = request.session.get('patient_id')
    token_entry = _get_token_entry(request)
    
    if not patient_id or not token_entry:
        raise HTTPException(
            status_code=401,
            detail="No patient context available. Please authenticate first."
        )
    
    return {
        "patient_id": patient_id,
        "has_access": True
    }