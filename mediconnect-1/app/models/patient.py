from pydantic import BaseModel
from typing import Optional, List, Any, Dict

class Patient(BaseModel):
    """
    Simplified patient model for internal use.
    """
    id: str
    name: str
    gender: Optional[str] = None
    birthDate: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class PatientResponse(BaseModel):
    """
    FHIR-compliant Patient resource structure.
    """
    resourceType: str = "Patient"
    id: str
    name: List[Dict[str, Any]]
    gender: Optional[str] = None
    birthDate: Optional[str] = None
    address: Optional[List[Dict[str, Any]]] = None
    telecom: Optional[List[Dict[str, Any]]] = None

class PatientSearchResult(BaseModel):
    """
    Search result for patient queries.
    """
    patient_id: str
    name: str
    birthdate: Optional[str] = None
    gender: Optional[str] = None
    identifier: Optional[str] = None

class AllergyInfo(BaseModel):
    """
    Simplified allergy information for EMT display.
    """
    allergen: str
    reaction: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None

class MedicationInfo(BaseModel):
    """
    Simplified medication information for EMT display.
    """
    medication_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    status: Optional[str] = None

class ConditionInfo(BaseModel):
    """
    Simplified condition/diagnosis information.
    """
    condition_name: str
    clinical_status: Optional[str] = None
    onset_date: Optional[str] = None
    severity: Optional[str] = None

class VitalSign(BaseModel):
    """
    Vital sign observation.
    """
    type: str  # e.g., "blood-pressure", "heart-rate", "temperature"
    value: str
    unit: str
    timestamp: Optional[str] = None

class ComprehensivePatientData(BaseModel):
    """
    Comprehensive patient data model for EMT use.
    Contains all critical information needed for emergency treatment.
    """
    patient_id: str
    patient_name: str
    demographics: Dict[str, Any]
    allergies: List[str]
    medications: List[str]
    conditions: Dict[str, Any]
    vital_signs: Dict[str, Any]
    procedures: Dict[str, Any]
    immunizations: Dict[str, Any]