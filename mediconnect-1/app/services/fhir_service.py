from typing import Any, Dict, List, Optional
import httpx
from fastapi import HTTPException
from app.core.config import settings

class FHIRService:
    """
    Service class to handle FHIR API interactions.
    Fetches patient data from the FHIR server using OAuth2 access tokens.
    """
    
    def __init__(self):
        self.base_url = settings.fhir_server_url
        self.client_id = settings.client_id

    def _build_headers(self, access_token: str) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/fhir+json"
        }
        if self.client_id:
            headers["Epic-Client-ID"] = self.client_id
        return headers

    def _format_fhir_error(self, resource: str, response: httpx.Response) -> HTTPException:
        detail_message = ""
        try:
            payload = response.json()
            if isinstance(payload, dict):
                issues = payload.get("issue")
                if isinstance(issues, list) and issues:
                    first_issue = issues[0]
                    detail_message = first_issue.get("diagnostics") or first_issue.get("details", {}).get("text", "")
                detail_message = detail_message or payload.get("detail") or payload.get("error_description", "")
        except ValueError:
            # Response was not JSON
            detail_message = response.text

        detail_message = (detail_message or response.text or "No additional details provided").strip()

        hint = ""
        if response.status_code == 401:
            hint = "Ensure your OAuth session is still valid and refresh the login if needed."
        elif response.status_code == 403:
            hint = (
                "The FHIR server denied access (403). Verify that the authenticated user has permission "
                "to read patient data and that the SMART launch included the required patient-level scopes."
            )
        elif response.status_code == 404:
            hint = "The resource could not be found. Double-check that the patient ID is correct."

        composed_detail = f"Failed to fetch {resource}: {detail_message}"
        if hint:
            composed_detail = f"{composed_detail} Hint: {hint}"

        return HTTPException(status_code=response.status_code, detail=composed_detail)

    async def fetch_patient(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch basic patient demographics from FHIR server.
        """
        url = f"{self.base_url}/Patient/{patient_id}"
        headers = self._build_headers(access_token)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                raise self._format_fhir_error("patient", response)
            return response.json()

    async def fetch_conditions(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch patient's medical conditions.
        """
        url = f"{self.base_url}/Condition"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise self._format_fhir_error("conditions", response)
            return response.json()

    async def fetch_allergies(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch patient's allergies and intolerances.
        """
        url = f"{self.base_url}/AllergyIntolerance"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise self._format_fhir_error("allergies", response)
            return response.json()

    async def fetch_medications(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch patient's current medications.
        """
        url = f"{self.base_url}/MedicationRequest"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id, "status": "active"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise self._format_fhir_error("medications", response)
            return response.json()

    async def fetch_observations(self, patient_id: str, access_token: str, category: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetch patient's observations (vital signs, lab results, etc.).
        """
        url = f"{self.base_url}/Observation"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        if category:
            params["category"] = category
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise self._format_fhir_error("observations", response)
            return response.json()

    async def fetch_procedures(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch patient's procedure history.
        """
        url = f"{self.base_url}/Procedure"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise self._format_fhir_error("procedures", response)
            return response.json()

    async def fetch_immunizations(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch patient's immunization history.
        """
        url = f"{self.base_url}/Immunization"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise self._format_fhir_error("immunizations", response)
            return response.json()

    async def fetch_comprehensive_patient_data(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch comprehensive patient data including demographics, conditions, allergies, medications, etc.
        This is the main endpoint EMTs will use to get all critical patient information.
        """
        try:
            # Fetch all patient data in parallel for better performance
            async with httpx.AsyncClient() as client:
                patient_data = await self.fetch_patient(patient_id, access_token)
                conditions_data = await self.fetch_conditions(patient_id, access_token)
                allergies_data = await self.fetch_allergies(patient_id, access_token)
                medications_data = await self.fetch_medications(patient_id, access_token)
                observations_data = await self.fetch_observations(patient_id, access_token, "vital-signs")
                procedures_data = await self.fetch_procedures(patient_id, access_token)
                immunizations_data = await self.fetch_immunizations(patient_id, access_token)
            
            return {
                "patient": patient_data,
                "conditions": conditions_data,
                "allergies": allergies_data,
                "medications": medications_data,
                "vital_signs": observations_data,
                "procedures": procedures_data,
                "immunizations": immunizations_data
            }
        except HTTPException as exc:
            raise exc
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch comprehensive patient data: {str(e)}"
            )

    def parse_patient_name(self, patient_data: Dict[str, Any]) -> str:
        """
        Helper function to parse patient name from FHIR Patient resource.
        """
        if "name" in patient_data and len(patient_data["name"]) > 0:
            name = patient_data["name"][0]
            given = " ".join(name.get("given", []))
            family = name.get("family", "")
            return f"{given} {family}".strip()
        return "Unknown"

    def parse_allergies_summary(self, allergies_data: Dict[str, Any]) -> List[str]:
        """
        Helper function to extract allergy names from FHIR AllergyIntolerance bundle.
        """
        allergies = []
        if "entry" in allergies_data:
            for entry in allergies_data["entry"]:
                resource = entry.get("resource", {})
                if "code" in resource and "coding" in resource["code"]:
                    coding = resource["code"]["coding"][0]
                    allergies.append(coding.get("display", "Unknown Allergy"))
        return allergies

    def parse_medications_summary(self, medications_data: Dict[str, Any]) -> List[str]:
        """
        Helper function to extract medication names from FHIR MedicationRequest bundle.
        """
        medications = []
        if "entry" in medications_data:
            for entry in medications_data["entry"]:
                resource = entry.get("resource", {})
                if "medicationCodeableConcept" in resource:
                    med_concept = resource["medicationCodeableConcept"]
                    if "coding" in med_concept and len(med_concept["coding"]) > 0:
                        medications.append(med_concept["coding"][0].get("display", "Unknown Medication"))
        return medications