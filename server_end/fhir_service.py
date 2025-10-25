"""
FHIR Service Module for Epic FHIR API Integration
Handles OAuth2 authentication and FHIR resource fetching
"""
from typing import Any, Dict, Optional
import httpx
import os
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class FHIRService:
    """
    Service class to handle FHIR API interactions with Epic.
    Fetches patient data using OAuth2 access tokens.
    """
    
    def __init__(self):
        self.base_url = os.getenv("FHIR_SERVER_URL", "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4")
        self.client_id = os.getenv("CLIENT_ID")

    def _build_headers(self, access_token: str) -> Dict[str, str]:
        """Build headers for FHIR API requests"""
        headers: Dict[str, str] = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/fhir+json"
        }
        if self.client_id:
            headers["Epic-Client-ID"] = self.client_id
        return headers

    def _format_fhir_error(self, resource: str, response: httpx.Response) -> HTTPException:
        """Format FHIR API error responses"""
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
            detail_message = response.text

        detail_message = (detail_message or response.text or "No additional details provided").strip()

        hint = ""
        if response.status_code == 401:
            hint = "OAuth session expired or invalid. Please re-authenticate."
        elif response.status_code == 403:
            hint = "Access denied. Verify FHIR scopes are granted and patient has data access permissions."
        elif response.status_code == 404:
            hint = "Resource not found. Verify patient ID is correct."

        composed_detail = f"Failed to fetch {resource}: {detail_message}"
        if hint:
            composed_detail = f"{composed_detail} | {hint}"

        return HTTPException(status_code=response.status_code, detail=composed_detail)

    async def fetch_patient(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """Fetch patient demographics from FHIR server"""
        url = f"{self.base_url}/Patient/{patient_id}"
        headers = self._build_headers(access_token)
        
        logger.info(f"Fetching patient demographics: patient_id={patient_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30.0)
            
            if response.status_code != 200:
                logger.error(f"Patient fetch failed: {response.status_code} - {response.text}")
                raise self._format_fhir_error("patient demographics", response)
            
            return response.json()

    async def fetch_allergies(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """Fetch patient's allergies and intolerances"""
        url = f"{self.base_url}/AllergyIntolerance"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        logger.info(f"Fetching allergies: patient_id={patient_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
            
            if response.status_code != 200:
                logger.warning(f"Allergies fetch returned {response.status_code}")
                raise self._format_fhir_error("allergies", response)
            
            return response.json()

    async def fetch_conditions(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """Fetch patient's medical conditions"""
        url = f"{self.base_url}/Condition"
        headers = self._build_headers(access_token)
        params = {
            "patient": patient_id,
            "category": "http://terminology.hl7.org/CodeSystem/condition-category|problem-list-item"
        }
        
        logger.info(f"Fetching conditions: patient_id={patient_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
            
            if response.status_code != 200:
                logger.warning(f"Conditions fetch returned {response.status_code}")
                raise self._format_fhir_error("conditions", response)
            
            return response.json()

    async def fetch_medications(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """Fetch patient's medications"""
        url = f"{self.base_url}/MedicationRequest"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        logger.info(f"Fetching medications: patient_id={patient_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
            
            if response.status_code != 200:
                logger.warning(f"Medications fetch returned {response.status_code}")
                raise self._format_fhir_error("medications", response)
            
            return response.json()

    async def fetch_observations(self, patient_id: str, access_token: str, category: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetch patient's observations (vital signs, lab results, social history)
        
        Args:
            patient_id: FHIR patient ID
            access_token: OAuth2 access token
            category: Optional category filter ('vital-signs', 'laboratory', 'social-history')
        """
        url = f"{self.base_url}/Observation"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        if category:
            category_map = {
                "vital-signs": "http://terminology.hl7.org/CodeSystem/observation-category|vital-signs",
                "laboratory": "http://terminology.hl7.org/CodeSystem/observation-category|laboratory",
                "social-history": "http://terminology.hl7.org/CodeSystem/observation-category|social-history",
            }
            params["category"] = category_map.get(category, category)
        
        logger.info(f"Fetching observations: patient_id={patient_id}, category={category}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
            
            if response.status_code != 200:
                logger.warning(f"Observations fetch returned {response.status_code}")
                raise self._format_fhir_error(f"observations (category: {category})", response)
            
            return response.json()

    async def fetch_procedures(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """Fetch patient's procedure history"""
        url = f"{self.base_url}/Procedure"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        logger.info(f"Fetching procedures: patient_id={patient_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
            
            if response.status_code != 200:
                logger.warning(f"Procedures fetch returned {response.status_code}")
                raise self._format_fhir_error("procedures", response)
            
            return response.json()

    async def fetch_immunizations(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """Fetch patient's immunization history"""
        url = f"{self.base_url}/Immunization"
        headers = self._build_headers(access_token)
        params = {"patient": patient_id}
        
        logger.info(f"Fetching immunizations: patient_id={patient_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
            
            if response.status_code != 200:
                logger.warning(f"Immunizations fetch returned {response.status_code}")
                raise self._format_fhir_error("immunizations", response)
            
            return response.json()

    async def fetch_comprehensive_patient_data(self, patient_id: str, access_token: str) -> Dict[str, Any]:
        """
        Fetch comprehensive patient data including demographics, conditions, allergies, medications, etc.
        Returns all available data, gracefully handling 403 errors for restricted resources.
        """
        logger.info(f"Fetching comprehensive patient data: patient_id={patient_id}")
        
        result = {
            "patient_id": patient_id,
            "patient": None,
            "allergies": {"resourceType": "Bundle", "entry": []},
            "conditions": {"resourceType": "Bundle", "entry": []},
            "medications": {"resourceType": "Bundle", "entry": []},
            "observations": {"resourceType": "Bundle", "entry": []},
            "procedures": {"resourceType": "Bundle", "entry": []},
            "immunizations": {"resourceType": "Bundle", "entry": []},
            "errors": []
        }
        
        # Fetch patient demographics
        try:
            result["patient"] = await self.fetch_patient(patient_id, access_token)
            logger.info("✅ Patient demographics fetched")
        except HTTPException as exc:
            logger.error(f"❌ Patient demographics failed: {exc.detail}")
            result["errors"].append({"resource": "patient", "error": exc.detail})
        
        # Fetch allergies
        try:
            result["allergies"] = await self.fetch_allergies(patient_id, access_token)
            logger.info("✅ Allergies fetched")
        except HTTPException as exc:
            if exc.status_code != 403:
                logger.error(f"❌ Allergies failed: {exc.detail}")
            result["errors"].append({"resource": "allergies", "error": exc.detail})
        
        # Fetch conditions
        try:
            result["conditions"] = await self.fetch_conditions(patient_id, access_token)
            logger.info("✅ Conditions fetched")
        except HTTPException as exc:
            if exc.status_code != 403:
                logger.error(f"❌ Conditions failed: {exc.detail}")
            result["errors"].append({"resource": "conditions", "error": exc.detail})
        
        # Fetch medications
        try:
            result["medications"] = await self.fetch_medications(patient_id, access_token)
            logger.info("✅ Medications fetched")
        except HTTPException as exc:
            if exc.status_code != 403:
                logger.error(f"❌ Medications failed: {exc.detail}")
            result["errors"].append({"resource": "medications", "error": exc.detail})
        
        # Fetch observations (vital signs, labs, social history)
        obs_categories = ["vital-signs", "laboratory", "social-history"]
        for category in obs_categories:
            try:
                obs_data = await self.fetch_observations(patient_id, access_token, category)
                if obs_data.get("entry"):
                    result["observations"]["entry"].extend(obs_data["entry"])
                logger.info(f"✅ Observations ({category}) fetched")
            except HTTPException as exc:
                if exc.status_code != 403:
                    logger.error(f"❌ Observations ({category}) failed: {exc.detail}")
                result["errors"].append({"resource": f"observations-{category}", "error": exc.detail})
        
        # Fetch procedures
        try:
            result["procedures"] = await self.fetch_procedures(patient_id, access_token)
            logger.info("✅ Procedures fetched")
        except HTTPException as exc:
            if exc.status_code != 403:
                logger.error(f"❌ Procedures failed: {exc.detail}")
            result["errors"].append({"resource": "procedures", "error": exc.detail})
        
        # Fetch immunizations
        try:
            result["immunizations"] = await self.fetch_immunizations(patient_id, access_token)
            logger.info("✅ Immunizations fetched")
        except HTTPException as exc:
            if exc.status_code != 403:
                logger.error(f"❌ Immunizations failed: {exc.detail}")
            result["errors"].append({"resource": "immunizations", "error": exc.detail})
        
        return result
