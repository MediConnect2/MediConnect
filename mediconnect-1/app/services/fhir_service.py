from typing import Any, Dict, List, Optional
import httpx
from fastapi import HTTPException
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

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
        
        logger.debug(
            f"Fetching patient data | URL: {url} | "
            f"Headers: {list(headers.keys())} | "
            f"Token preview: {access_token[:30]}...{access_token[-10:]}"
        )
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            
            logger.debug(
                f"FHIR Response | Status: {response.status_code} | "
                f"Headers: {dict(response.headers)}"
            )
            
            if response.status_code != 200:
                logger.error(f"FHIR Error Response: {response.text}")
                raise self._format_fhir_error("patient", response)
            return response.json()

    async def fetch_conditions(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch patient's medical conditions.
        Epic requires category filter with full system URL
        """
        url = f"{self.base_url}/Condition"
        headers = self._build_headers(access_token)
        params = {
            "patient": patient_id,
            "category": "http://terminology.hl7.org/CodeSystem/condition-category|problem-list-item"
        }
        
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

    async def fetch_medications(self, patient_id: str, access_token: str, include_status: bool = False) -> Dict[str, Any]:
        """
        Fetch patient's medications.
        Epic may not support status filtering - try without it if needed.
        """
        url = f"{self.base_url}/MedicationRequest"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        if include_status:
            params["status"] = "active"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            if response.status_code != 200:
                raise self._format_fhir_error("medications", response)
            return response.json()

    async def fetch_observations(self, patient_id: str, access_token: str, category: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetch patient's observations (vital signs, lab results, social history including smoking status, etc.).
        Epic-specific: Use full system URL format for category.
        category should be one of:
        - 'vital-signs' - Blood pressure, heart rate, temperature, etc.
        - 'laboratory' - Lab results, blood tests, etc.
        - 'social-history' - Smoking status, alcohol use, etc. ⚠️ IMPORTANT FOR SMOKING HISTORY
        - 'imaging' - Radiology observations
        - 'survey' - Survey/questionnaire responses
        
        NOTE: If you get 403 Forbidden, the patient/Observation.read scope was not granted by Epic.
        Check your Epic app configuration: https://fhir.epic.com/Developer/Apps
        """
        url = f"{self.base_url}/Observation"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        if category:
            # Convert short category codes to full Epic-required format
            category_map = {
                "vital-signs": "http://terminology.hl7.org/CodeSystem/observation-category|vital-signs",
                "laboratory": "http://terminology.hl7.org/CodeSystem/observation-category|laboratory",
                "social-history": "http://terminology.hl7.org/CodeSystem/observation-category|social-history",
                "imaging": "http://terminology.hl7.org/CodeSystem/observation-category|imaging",
                "survey": "http://terminology.hl7.org/CodeSystem/observation-category|survey"
            }
            params["category"] = category_map.get(category, category)
        
        logger.info(f"🔍 TEST: Fetching observations WITH category={category}: URL={url}, params={params}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            logger.info(f"🔍 TEST: Observation response status={response.status_code}, category={category}")
            if response.status_code == 200:
                data = response.json()
                entry_count = len(data.get("entry", []))
                logger.info(f"✅ SUCCESS! Got {entry_count} observation entries for category={category}")
                return data
            else:
                logger.warning(f"❌ FAILED: {response.status_code} for category={category}")
                raise self._format_fhir_error(f"observations (category: {category})", response)

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
            # GRACEFUL FALLBACK: Fetch what we can access, skip what returns 403
            logger.info(f"Fetching patient data for patient_id: {patient_id}")
            
            # Initialize all data structures
            patient_data = None
            conditions_data = {"resourceType": "Bundle", "entry": []}
            allergies_data = {"resourceType": "Bundle", "entry": []}
            medications_data = {"resourceType": "Bundle", "entry": []}
            observations_data = {"resourceType": "Bundle", "entry": []}
            procedures_data = {"resourceType": "Bundle", "entry": []}
            immunizations_data = {"resourceType": "Bundle", "entry": []}
            
            # Try to fetch patient demographics
            try:
                patient_data = await self.fetch_patient(patient_id, access_token)
                logger.info("✅ Successfully fetched patient demographics")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Patient demographics fetch returned 403 - using placeholder data")
                    patient_data = {
                        "resourceType": "Patient",
                        "id": patient_id,
                        "name": [{"given": ["Patient"], "family": patient_id[:8]}],
                        "text": {"status": "generated", "div": f"<div>Patient ID: {patient_id}</div>"}
                    }
                else:
                    raise
            
            # Try to fetch conditions
            try:
                conditions_data = await self.fetch_conditions(patient_id, access_token)
                logger.info("✅ Successfully fetched conditions")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Conditions fetch returned 403 - scope not granted")
                else:
                    logger.error(f"❌ Conditions fetch failed: {exc.detail}")
            
            # Try to fetch allergies
            try:
                allergies_data = await self.fetch_allergies(patient_id, access_token)
                logger.info("✅ Successfully fetched allergies")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Allergies fetch returned 403 - scope not granted")
                else:
                    logger.error(f"❌ Allergies fetch failed: {exc.detail}")
            
            # Try to fetch medications (try without status filter first)
            try:
                medications_data = await self.fetch_medications(patient_id, access_token, include_status=False)
                logger.info("✅ Successfully fetched medications")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Medications fetch returned 403 - scope not granted")
                else:
                    logger.error(f"❌ Medications fetch failed: {exc.detail}")
            
            # Try to fetch vital signs, laboratory, and social history observations
            vital_signs_data = {"resourceType": "Bundle", "entry": []}
            laboratory_data = {"resourceType": "Bundle", "entry": []}
            social_history_data = {"resourceType": "Bundle", "entry": []}
            
            # Fetch vital signs
            try:
                vital_signs_data = await self.fetch_observations(patient_id, access_token, "vital-signs")
                logger.info("✅ Successfully fetched vital signs")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Vital signs fetch returned 403 - scope not granted")
                else:
                    logger.error(f"❌ Vital signs fetch failed: {exc.detail}")
            
            # Fetch laboratory observations
            try:
                laboratory_data = await self.fetch_observations(patient_id, access_token, "laboratory")
                logger.info("✅ Successfully fetched laboratory observations")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Laboratory observations fetch returned 403 - scope not granted")
                else:
                    logger.error(f"❌ Laboratory observations fetch failed: {exc.detail}")
            
            # Fetch social history (smoking status, alcohol use, etc.) - CRITICAL FOR SMOKING HISTORY
            try:
                social_history_data = await self.fetch_observations(patient_id, access_token, "social-history")
                logger.info("✅ Successfully fetched social history (smoking status, etc.)")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Social history fetch returned 403 - scope not granted")
                else:
                    logger.error(f"❌ Social history fetch failed: {exc.detail}")
            
            # Combine all observation data
            observations_data = {"resourceType": "Bundle", "entry": []}
            if vital_signs_data.get("entry"):
                observations_data["entry"].extend(vital_signs_data.get("entry", []))
            if laboratory_data.get("entry"):
                observations_data["entry"].extend(laboratory_data.get("entry", []))
            if social_history_data.get("entry"):
                observations_data["entry"].extend(social_history_data.get("entry", []))
            
            # Try to fetch procedures
            try:
                procedures_data = await self.fetch_procedures(patient_id, access_token)
                logger.info("✅ Successfully fetched procedures")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Procedures fetch returned 403 - scope not granted")
                else:
                    logger.error(f"❌ Procedures fetch failed: {exc.detail}")
            
            # Try to fetch immunizations
            try:
                immunizations_data = await self.fetch_immunizations(patient_id, access_token)
                logger.info("✅ Successfully fetched immunizations")
            except HTTPException as exc:
                if exc.status_code == 403:
                    logger.warning("⚠️ Immunizations fetch returned 403 - scope not granted")
                else:
                    logger.error(f"❌ Immunizations fetch failed: {exc.detail}")
            
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
            logger.exception("Failed to fetch comprehensive patient data")
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