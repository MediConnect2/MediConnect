"""
FHIR OAuth2 Handler for Epic SMART on FHIR Authentication
Manages OAuth2 authorization code flow with PKCE
"""
import os
import secrets
import base64
import hashlib
import httpx
import time
from typing import Dict, Any, Optional
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import RedirectResponse
import logging

logger = logging.getLogger(__name__)

# In-memory token store (use Redis or database in production)
token_store: Dict[str, Dict[str, Any]] = {}


class FHIROAuthHandler:
    """Handles OAuth2 authentication flow for Epic FHIR API"""
    
    def __init__(self):
        self.client_id = os.getenv("CLIENT_ID")
        self.client_secret = os.getenv("CLIENT_SECRET", "")
        self.redirect_uri = os.getenv("REDIRECT_URI", "https://localhost:8000/callback")
        self.fhir_server_url = os.getenv("FHIR_SERVER_URL")
        self.scopes = os.getenv("FHIR_SCOPES", "patient/Patient.r patient/AllergyIntolerance.r launch/patient openid fhirUser")
        
        # Epic OAuth endpoints
        self.authorization_url = "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize"
        self.token_url = "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        
    def generate_pkce_pair(self) -> tuple[str, str]:
        """
        Generate PKCE code verifier and challenge
        Returns: (code_verifier, code_challenge)
        """
        # Generate random code verifier (43-128 characters)
        code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
        
        # Create code challenge (SHA256 hash of verifier)
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode('utf-8')).digest()
        ).decode('utf-8').rstrip('=')
        
        return code_verifier, code_challenge
    
    def initiate_patient_login(self, request: Request, session_id: str) -> RedirectResponse:
        """
        Initiate patient portal OAuth flow
        
        Args:
            request: FastAPI request object
            session_id: Unique session identifier for state management
            
        Returns:
            RedirectResponse to Epic authorization endpoint
        """
        # Generate PKCE pair
        code_verifier, code_challenge = self.generate_pkce_pair()
        
        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Store session data using STATE as the key (since Epic only returns state in callback)
        # Also store a mapping from session_id to state for frontend reference
        token_store[state] = {
            "code_verifier": code_verifier,
            "state": state,
            "session_id": session_id,
            "timestamp": int(time.time())
        }
        
        # Store mapping for frontend to retrieve state later if needed
        token_store[f"session_{session_id}"] = {"state": state}
        
        logger.info(f"Stored OAuth session | session_id={session_id} | state={state[:10]}...")
        
        # Build authorization URL
        auth_params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": self.scopes,
            "state": state,
            "aud": self.fhir_server_url,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256"
        }
        
        # Construct full authorization URL
        from urllib.parse import urlencode
        auth_url = f"{self.authorization_url}?{urlencode(auth_params)}"
        
        logger.info(f"🔐 Initiating patient login | session={session_id} | client_id={self.client_id}")
        logger.info(f"📋 OAuth Parameters:")
        logger.info(f"   - response_type: {auth_params['response_type']}")
        logger.info(f"   - client_id: {auth_params['client_id']}")
        logger.info(f"   - redirect_uri: {auth_params['redirect_uri']}")
        logger.info(f"   - scope: {auth_params['scope']}")
        logger.info(f"   - aud: {auth_params['aud']}")
        logger.info(f"   - code_challenge_method: {auth_params['code_challenge_method']}")
        logger.info(f"🌐 Full Authorization URL: {auth_url}")
        
        return RedirectResponse(url=auth_url, status_code=307)
    
    async def handle_callback(
        self, 
        code: str, 
        state: str
    ) -> Dict[str, Any]:
        """
        Handle OAuth callback and exchange authorization code for access token
        
        Args:
            code: Authorization code from Epic
            state: State parameter for CSRF validation (also serves as session lookup key)
            
        Returns:
            Dict containing access_token, patient_id, and other OAuth response data
        """
        # Retrieve session data using STATE as the key
        session_data = token_store.get(state)
        if not session_data:
            logger.error(f"❌ Session not found for state: {state[:10]}...")
            raise HTTPException(status_code=400, detail="Invalid session. Please restart login.")
        
        # Validate state (CSRF protection) - should always match since we're using it as the key
        if session_data["state"] != state:
            logger.error(f"❌ State mismatch | expected={session_data['state']} | received={state}")
            raise HTTPException(status_code=400, detail="Invalid state parameter. Possible CSRF attack.")
        
        code_verifier = session_data["code_verifier"]
        session_id = session_data.get("session_id", state)  # Fallback to state if no session_id
        
        # Exchange authorization code for access token
        token_params = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id,
            "code_verifier": code_verifier
        }
        
        logger.info(f"🔄 Exchanging authorization code for token | session={session_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_url,
                data=token_params,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"❌ Token exchange failed: {response.status_code} - {response.text}")
                try:
                    error_details = response.json()
                    detail_message = f"Token exchange failed: {error_details}"
                except Exception:
                    detail_message = f"Token exchange failed: {response.text}"
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=detail_message
                )
            
            token_data = response.json()
        
        # Extract important data
        access_token = token_data.get("access_token")
        patient_id = token_data.get("patient")
        scope = token_data.get("scope", "")
        expires_in = token_data.get("expires_in", 3600)
        
        if not access_token:
            logger.error("❌ No access token in response")
            raise HTTPException(status_code=500, detail="No access token received from Epic")
        
        if not patient_id:
            logger.warning("⚠️ No patient ID in token response")
        
        # Store token data using STATE as the key (for consistency)
        # Also store using session_id for frontend lookups
        token_data_obj = {
            "access_token": access_token,
            "patient_id": patient_id,
            "scope": scope,
            "expires_in": expires_in,
            "token_type": token_data.get("token_type", "Bearer"),
            "fhir_user": token_data.get("fhirUser", ""),
            "id_token": token_data.get("id_token", ""),
            "session_id": session_id,
            "state": state
        }
        
        token_store[state] = token_data_obj
        token_store[session_id] = token_data_obj  # Also store by session_id for frontend
        
        logger.info(f"✅ Token exchange successful | patient_id={patient_id} | session={session_id}")
        logger.info(f"📋 Granted scopes: {scope}")
        
        return token_data_obj
    
    def get_token(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve stored token data for a session"""
        return token_store.get(session_id)
    
    def clear_token(self, session_id: str) -> None:
        """Clear stored token data for a session"""
        if session_id in token_store:
            del token_store[session_id]
            logger.info(f"🗑️ Token cleared for session: {session_id}")
