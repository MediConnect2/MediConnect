from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from app.api.endpoints import patients, fhir
from app.core.config import settings
import logging
import json
import uuid
import jwt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory token store: {session_id: {token, patient_id}}
token_store = {}
logger.setLevel(logging.DEBUG)
app = FastAPI(title=settings.app_name, version=settings.app_version)
app.state.token_store = token_store


def mask_secret(value: str, visible_start: int = 6, visible_end: int = 4) -> str:
    """Utility to mask sensitive strings for logging."""
    if not value:
        return ""
    if len(value) <= visible_start + visible_end:
        return value
    return f"{value[:visible_start]}...{value[-visible_end:]}"


def _format_context(context: dict) -> str:
    try:
        return json.dumps(context, default=str)
    except TypeError:
        safe_context = {k: str(v) for k, v in context.items()}
        return json.dumps(safe_context)


def sanitize_userinfo(userinfo: dict) -> dict:
    """Return a JSON-serializable copy of the userinfo payload."""
    if not isinstance(userinfo, dict):
        return {}
    try:
        return json.loads(json.dumps(userinfo, default=str))
    except (TypeError, ValueError):
        return {k: str(v) for k, v in userinfo.items()}


def log_debug(message: str, **context):
    if logger.isEnabledFor(logging.DEBUG):
        logger.debug("%s | context=%s", message, _format_context(context))


def log_info(message: str, **context):
    if logger.isEnabledFor(logging.INFO):
        logger.info("%s | context=%s", message, _format_context(context))


def log_error(message: str, **context):
    if logger.isEnabledFor(logging.ERROR):
        logger.error("%s | context=%s", message, _format_context(context))

# Add Session Middleware (required for OAuth)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret_key,
    session_cookie="mediconnect_session",
    same_site="none",
    https_only=True,
)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OAuth
oauth = OAuth()

# Determine token endpoint auth method based on whether client_secret is provided
token_auth_method = 'none' if not settings.client_secret else 'client_secret_basic'

# Register the EHR OAuth client
# Epic sandbox uses .well-known/smart-configuration for SMART on FHIR discovery
oauth.register(
    name='ehr',
    client_id=settings.client_id,
    client_secret=settings.client_secret if settings.client_secret else None,
    server_metadata_url=f"{settings.fhir_server_url}/.well-known/smart-configuration",
    token_endpoint_auth_method=token_auth_method,
    client_kwargs={
        'scope': settings.fhir_scopes,
        'redirect_uri': settings.redirect_uri,
    },
)

log_info(
    "OAuth client configured",
    client_id=settings.client_id,
    client_secret_preview=mask_secret(settings.client_secret) if settings.client_secret else "None (public client)",
    redirect_uri=settings.redirect_uri,
    token_endpoint_auth_method=token_auth_method,
    scopes=settings.fhir_scopes,
    metadata_url=f"{settings.fhir_server_url}/.well-known/smart-configuration",
)

# Include routers
app.include_router(patients.router, prefix="/api", tags=["patients"])
app.include_router(fhir.router, prefix="/api", tags=["fhir"])

@app.get("/")
def read_root():
    return {
        "message": "Welcome to the MediConnect API",
        "version": settings.app_version,
        "documentation": "/docs"
    }

logger = logging.getLogger(__name__)

@app.get("/login")
async def login(request: Request):
    """
    Initiates the SMART on FHIR OAuth2 authorization flow.
    Redirects to the EHR's login page (defaults to provider portal).
    For patient portal login, use /patient-login instead.
    """
    try:
        redirect_uri = settings.redirect_uri

        session_keys_before = list(request.session.keys())
        log_debug(
            "Login request received",
            client_host=getattr(request.client, 'host', None),
            client_port=getattr(request.client, 'port', None),
            headers_host=request.headers.get('host'),
            session_keys_before=session_keys_before,
            cookies_present=list(request.cookies.keys()),
        )

        if session_keys_before:
            previous_session_id = request.session.get('session_id')
            if previous_session_id and previous_session_id in token_store:
                token_store.pop(previous_session_id, None)
                log_debug(
                    "Removed existing token store entry prior to new login",
                    session_id=previous_session_id,
                )
            log_debug(
                "Clearing existing session before new OAuth login",
                keys=session_keys_before,
                cookie_size_bytes=sum(len(v) for v in request.cookies.values() if isinstance(v, str)),
            )
            request.session.clear()

        # SMART on FHIR requires the "aud" parameter when requesting
        # patient-level scopes. This value must match the FHIR base URL.
        authorize_params = {
            "aud": settings.fhir_server_url
        }

        response = await oauth.ehr.authorize_redirect(
            request,
            redirect_uri,
            **authorize_params
        )
        redirect_url = response.headers.get('location', '')
        log_info(
            "Redirecting to EHR authorization endpoint",
            redirect_url=redirect_url,
        )
        session_keys_after = list(request.session.keys())
        stored_state_key = next((k for k in session_keys_after if k.startswith("_state_ehr_")), None)
        log_debug(
            "OAuth request params",
            client_id=settings.client_id,
            aud=settings.fhir_server_url,
            scope=settings.fhir_scopes,
            redirect_uri=settings.redirect_uri,
            session_keys_after=session_keys_after,
            stored_state_key=stored_state_key,
            stored_state=request.session.get(stored_state_key) if stored_state_key else None,
            cookies_after=list(request.cookies.keys()),
        )
        return response
    except Exception as e:
        logger.exception("Failed to initiate SMART on FHIR login")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to initiate login", "details": str(e)}
        )

@app.get("/patient-login")
async def patient_login(request: Request):
    """
    Initiates the SMART on FHIR OAuth2 authorization flow for PATIENT portal access.
    This endpoint specifically targets Epic's MyChart patient login, not the provider portal.
    """
    try:
        redirect_uri = settings.redirect_uri

        session_keys_before = list(request.session.keys())
        log_debug(
            "Patient login request received",
            client_host=getattr(request.client, 'host', None),
            client_port=getattr(request.client, 'port', None),
            headers_host=request.headers.get('host'),
            session_keys_before=session_keys_before,
            cookies_present=list(request.cookies.keys()),
        )

        if session_keys_before:
            previous_session_id = request.session.get('session_id')
            if previous_session_id and previous_session_id in token_store:
                token_store.pop(previous_session_id, None)
                log_debug(
                    "Removed existing token store entry prior to new patient login",
                    session_id=previous_session_id,
                )
            log_debug(
                "Clearing existing session before new patient OAuth login",
                keys=session_keys_before,
                cookie_size_bytes=sum(len(v) for v in request.cookies.values() if isinstance(v, str)),
            )
            request.session.clear()

        # For patient portal access, we need to construct the authorization URL manually
        # to ensure we're using the patient-facing endpoint
        
        # Generate state and nonce for security
        import secrets
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(16)
        
        # Store state in session
        state_key = f"_state_patient_{state}"
        request.session[state_key] = {
            "data": {
                "redirect_uri": redirect_uri,
                "nonce": nonce,
            },
            "exp": 1760738474.7105696,  # Will be updated by session middleware
        }
        
        # Build authorization URL for patient portal
        from urllib.parse import urlencode
        
        auth_params = {
            "response_type": "code",
            "client_id": settings.client_id,
            "redirect_uri": redirect_uri,
            "scope": settings.fhir_scopes,
            "state": state,
            "aud": settings.fhir_server_url,
        }
        
        # Use Epic Open sandbox authorization endpoint for patient portal (MyChart)
        # This is the correct endpoint for Epic's patient-facing sandbox
        auth_url = settings.patient_authorization_url  # https://open-ic.epic.com/MyChart/default.asp
        authorization_url = f"{auth_url}?{urlencode(auth_params)}"
        
        log_info(
            "Redirecting to PATIENT portal authorization endpoint",
            redirect_url=authorization_url,
            client_id=settings.client_id,
        )
        
        log_debug(
            "Patient OAuth request params",
            client_id=settings.client_id,
            aud=settings.fhir_server_url,
            scope=settings.fhir_scopes,
            redirect_uri=redirect_uri,
            state=state,
            endpoint="patient-portal",
        )
        
        return RedirectResponse(url=authorization_url)
        
    except Exception as e:
        logger.exception("Failed to initiate patient portal login")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to initiate patient login", "details": str(e)}
        )

@app.get("/callback")
async def callback(request: Request):
    """
    Handles the OAuth2 callback from the EHR system.
    Exchanges the authorization code for an access token.
    """
    try:
        session_keys = list(request.session.keys())
        # Check for both provider (_state_ehr_) and patient (_state_patient_) state keys
        stored_state_key = next(
            (k for k in session_keys if k.startswith("_state_ehr_") or k.startswith("_state_patient_")), 
            None
        )
        stored_state_value = request.session.get(stored_state_key) if stored_state_key else None

        log_debug(
            "Callback invoked",
            request_url=str(request.url),
            query_params=dict(request.query_params),
            headers_host=request.headers.get('host'),
            user_agent=request.headers.get('user-agent'),
            session_keys=session_keys,
            stored_state_key=stored_state_key,
            stored_state=stored_state_value,
            cookies_present={k: len(v) if isinstance(v, str) else v for k, v in request.cookies.items()},
        )

        state_param = request.query_params.get('state')
        auth_code = request.query_params.get('code')
        
        # For manually constructed patient login, validate state manually
        is_patient_login = stored_state_key and stored_state_key.startswith("_state_patient_")
        
        if is_patient_login:
            # Extract state from the stored state key
            expected_state = stored_state_key.replace("_state_patient_", "")
            if state_param != expected_state:
                log_error(
                    "State mismatch for patient login",
                    expected=expected_state,
                    received=state_param,
                )
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "Authentication failed",
                        "details": "State parameter mismatch. Please try logging in again.",
                    }
                )
        
        log_debug(
            "Authorization response parameters",
            state_param=state_param,
            is_patient_login=is_patient_login,
            auth_code_preview=mask_secret(auth_code or '', visible_start=12, visible_end=6),
        )

        # Exchange the authorization code for an access token
        if is_patient_login:
            # For patient login, manually exchange the code since we constructed the auth URL manually
            import httpx
            
            # Get token endpoint from metadata
            metadata_url = f"{settings.fhir_server_url}/.well-known/smart-configuration"
            async with httpx.AsyncClient(verify=False) as client:
                metadata_resp = await client.get(metadata_url)
                metadata = metadata_resp.json()
                token_endpoint = metadata.get('token_endpoint')
                
                # Exchange authorization code for token
                token_data = {
                    'grant_type': 'authorization_code',
                    'code': auth_code,
                    'redirect_uri': settings.redirect_uri,
                    'client_id': settings.client_id,
                }
                
                log_debug(
                    "Exchanging authorization code for token",
                    token_endpoint=token_endpoint,
                    client_id=settings.client_id,
                )
                
                token_resp = await client.post(token_endpoint, data=token_data)
                token_resp.raise_for_status()
                token = token_resp.json()
                
            # Clear the patient state from session
            request.session.pop(stored_state_key, None)
        else:
            # For provider login, use Authlib's authorize_access_token
            token = await oauth.ehr.authorize_access_token(request)
            
        log_debug(
            "Access token received",
            token_keys=list(token.keys()),
            patient_id=token.get('patient'),
            token_type=token.get('token_type'),
            expires_in=token.get('expires_in'),
            scope=token.get('scope'),
            access_token_preview=mask_secret(token.get('access_token', ''), visible_start=20, visible_end=10),
        )
        
        # Generate a short session_id and store token server-side
        session_id = str(uuid.uuid4())
        
        # Decode the id_token to check for a patient ID
        id_token_payload = decode_id_token(token)

        userinfo = token.get('userinfo') or {}
        if not isinstance(userinfo, dict):  # defensive casting
            userinfo = {}

        fhir_user_raw = userinfo.get('fhirUser') or userinfo.get('profile') or ''
        fhir_user = fhir_user_raw if isinstance(fhir_user_raw, str) else ''

        patient_id_from_fhir_user = None
        if fhir_user:
            if "/Patient/" in fhir_user:
                patient_id_from_fhir_user = fhir_user.rsplit("/Patient/", 1)[-1].split("/")[0]
            elif fhir_user.startswith("Patient/"):
                patient_id_from_fhir_user = fhir_user.split("Patient/")[-1].split("/")[0]

        candidate_ids = [
            token.get('patient'),
            id_token_payload.get('patient'),
            userinfo.get('patient'),
            patient_id_from_fhir_user,
        ]

        derived_patient_id = next(
            (pid for pid in candidate_ids if isinstance(pid, str) and pid.strip()),
            None,
        )

        log_debug(
            "Evaluated patient context",
            candidate_ids=[pid for pid in candidate_ids if pid],
            id_token_keys=list(id_token_payload.keys()),
            fhir_user=fhir_user,
        )

        is_practitioner = isinstance(fhir_user, str) and 'Practitioner/' in fhir_user

        if not derived_patient_id:
            if is_practitioner:
                derived_patient_id = "PRACTITIONER_LOGIN"
                log_debug(
                    "Practitioner login detected - no patient context",
                    fhir_user=fhir_user,
                    sub=userinfo.get('sub'),
                )
            else:
                sub_value = userinfo.get('sub') or id_token_payload.get('sub')
                if isinstance(sub_value, str):
                    if sub_value.startswith("Patient/"):
                        derived_patient_id = sub_value.split("Patient/")[-1].split("/")[0]
                    elif "/Patient/" in sub_value:
                        derived_patient_id = sub_value.rsplit("/Patient/", 1)[-1].split("/")[0]
                    elif '/' not in sub_value:
                        derived_patient_id = sub_value
                if not derived_patient_id:
                    derived_patient_id = "Unknown"
        
        token_store[session_id] = {
            'token': token,
            'patient_id': derived_patient_id,
            'userinfo': sanitize_userinfo(userinfo),
            'is_practitioner': is_practitioner,
        }
        # Store session metadata in the cookie (small footprint only)
        request.session.clear()
        request.session['session_id'] = session_id
        request.session['patient_id'] = derived_patient_id
        request.session['is_practitioner'] = is_practitioner

        log_debug(
            "Session updated after token exchange (session_id only in cookie)",
            session_keys=list(request.session.keys()),
            stored_patient_id=derived_patient_id,
            is_practitioner=is_practitioner,
            fhir_user=fhir_user,
            userinfo=token_store[session_id]['userinfo'],
            scope=token.get('scope'),
            session_id=session_id,
        )
        # Redirect to the Next.js frontend dashboard
        return RedirectResponse(url="http://localhost:3000/fhir-access")
    except OAuthError as oauth_error:
        response = getattr(oauth_error, 'response', None)
        response_details = None
        if response is not None:
            try:
                response_details = {
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "text": response.text,
                }
            except Exception as resp_error:  # pragma: no cover - defensive
                response_details = {"error": f"Failed to read response body: {resp_error}"}

        session_keys = list(request.session.keys())
        stored_state_key = next((k for k in session_keys if k.startswith("_state_ehr_")), None)
        stored_state_value = request.session.get(stored_state_key) if stored_state_key else None

        log_error(
            "OAuthError during token exchange",
            error=getattr(oauth_error, 'error', None),
            description=getattr(oauth_error, 'description', None),
            uri=getattr(oauth_error, 'uri', None),
            response=response_details,
            session_keys=session_keys,
            stored_state_key=stored_state_key,
            stored_state=stored_state_value,
            state_param=request.query_params.get('state'),
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "Authentication failed",
                "details": f"{getattr(oauth_error, 'error', 'oauth_error')}: {getattr(oauth_error, 'description', '')}",
                "response": response_details,
            }
        )
    except Exception as e:
        logger.exception("SMART on FHIR callback failed")
        return JSONResponse(
            status_code=500,
            content={"error": "Authentication failed", "details": str(e)}
        )

@app.get("/api/auth-status")
async def check_auth_status(request: Request):
    """
    Checks if the user is authenticated and has a valid token.
    """
    session_id = request.session.get('session_id')
    session_keys = list(request.session.keys())
    if session_id and session_id in token_store:
        entry = token_store[session_id]
        token = entry.get('token', {})
        token_dict = token if isinstance(token, dict) else {}
        patient_id = entry.get('patient_id') or request.session.get('patient_id')
        userinfo = entry.get('userinfo', {})
        is_practitioner = entry.get('is_practitioner', False)
        patient_context_available = (
            isinstance(patient_id, str)
            and patient_id not in {"", "Unknown", "PRACTITIONER_LOGIN"}
        )
        expires_in = token_dict.get('expires_in')
        issued_at = token_dict.get('issued_at')
        expires_at = None
        if isinstance(expires_in, (int, float)) and isinstance(issued_at, (int, float)):
            expires_at = issued_at + expires_in
        log_debug(
            "Auth status check successful",
            session_id=session_id,
            session_keys=session_keys,
            has_token=bool(entry.get('token')),
            patient_id=patient_id,
            is_practitioner=is_practitioner,
            nonce=userinfo.get('nonce'),
        )
        return {
            "authenticated": True,
            "patient_id": patient_id,
            "is_practitioner": is_practitioner,
            "patient_context_available": patient_context_available,
            "token_type": token_dict.get('token_type', 'Bearer'),
            "scope": token_dict.get('scope'),
            "fhir_user": userinfo.get('sub') or userinfo.get('fhirUser'),
            "user_profile": userinfo,
            "expires_in": expires_in,
            "expires_at": expires_at,
        }
    log_debug(
        "Auth status check failed",
        session_id=session_id,
        session_keys=session_keys,
        token_store_has_entry=session_id in token_store if session_id else False,
    )
    return {"authenticated": False}

@app.post("/api/logout")
async def logout(request: Request):
    """
    Logs out the user by clearing the session.
    """
    session_id = request.session.get('session_id')
    if session_id and session_id in token_store:
        del token_store[session_id]
    request.session.clear()
    return {"message": "Logged out successfully"}

@app.get("/health")
async def health_check():
    """
    Health check endpoint to verify the API is running.
    """
    return {
        "status": "healthy",
        "fhir_server": settings.fhir_server_url
    }

def decode_id_token(token: dict) -> dict:
    """Safely decodes the id_token without signature verification."""
    id_token_str = token.get("id_token")
    if not id_token_str or not isinstance(id_token_str, str):
        return {}

    try:
        decoded = jwt.decode(
            id_token_str,
            options={
                "verify_signature": False,
                "verify_aud": False,
            },
        )
        return decoded if isinstance(decoded, dict) else {}
    except jwt.InvalidTokenError as exc:
        log_error("Failed to decode id_token payload", error=str(exc))
        return {}
    except Exception as exc:  # pragma: no cover - extra safety
        log_error("Unexpected error decoding id_token", error=str(exc))
        return {}