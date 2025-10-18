from typing import Optional

from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # FHIR Configuration
    fhir_server_url: str = "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
    # Prefer REDIRECT_URI from environment (Epic often requires HTTPS); default to https localhost
    redirect_uri: str = os.getenv("REDIRECT_URI", "https://localhost:8000/callback")
    client_id: str = os.getenv("CLIENT_ID", "")
    client_secret: str = os.getenv("CLIENT_SECRET", "")
    
    # JWT Key for Backend Services / Public Client
    jwt_signing_key: str = os.getenv("JWT_SIGNING_KEY", "")
    
    # Patient Portal Authorization URL (optional override)
    patient_authorization_url: str = os.getenv("PATIENT_AUTHORIZATION_URL", "")
    
    # Application Configuration
    app_name: str = "MediConnect"
    app_version: str = "1.0.0"
    
    # CORS Configuration
    cors_origins: list[str] | str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://localhost:3000,https://127.0.0.1:3000")

    # Optional overrides
    jwt_secret_key: str | None = None
    debug: bool = False
    
    # Session Configuration
    session_secret_key: str = os.getenv("SESSION_SECRET_KEY", "your-secret-key-change-in-production")
    
    # SMART on FHIR Scopes
    fhir_scopes: str = os.getenv(
        "FHIR_SCOPES",
        "openid fhirUser patient/Patient.read patient/Observation.read patient/Condition.read "
        "patient/AllergyIntolerance.read patient/MedicationRequest.read patient/Procedure.read patient/Immunization.read",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.cors_origins, str):
            cleaned = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
            return cleaned or ["http://localhost:3000", "http://127.0.0.1:3000"]
        return self.cors_origins

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

settings = Settings()