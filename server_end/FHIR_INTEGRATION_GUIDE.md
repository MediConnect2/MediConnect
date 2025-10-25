# MediConnect FHIR Integration Guide

## Overview

This guide explains how to use the FHIR integration endpoints in the MediConnect backend to fetch patient medical records from Epic FHIR API.

## Architecture

The FHIR integration consists of three main components:

1. **fhir_oauth.py**: Handles OAuth2 authentication with Epic FHIR
2. **fhir_service.py**: Makes FHIR API requests to fetch patient data
3. **main.py**: Exposes REST API endpoints for client applications

## Authentication Flow

The integration uses **OAuth2 Authorization Code Flow with PKCE** (Proof Key for Code Exchange) for security.

### Step-by-Step Flow:

```
1. Client → POST /fhir-login
   ↓
2. Server generates session_id and redirects to Epic
   ↓
3. Patient authenticates with Epic (MyChart login)
   ↓
4. Epic → GET /fhir-callback with authorization code
   ↓
5. Server exchanges code for access token
   ↓
6. Client → POST /fhir-request to fetch data
```

## API Endpoints

### 1. Initiate FHIR Login

**Endpoint:** `POST /fhir-login`

**Description:** Start the OAuth flow to authenticate a patient with Epic FHIR.

**Request Body:**
```json
{
  "patient_username": "john_doe"
}
```

**Response:**
```json
{
  "status": "redirect_required",
  "session_id": "fhir_john_doe_abc123xyz",
  "redirect_url": "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize?...",
  "message": "Redirect patient to this URL to complete Epic authentication"
}
```

**Client Action:** Redirect the patient to the `redirect_url` in a browser or WebView.

---

### 2. OAuth Callback (Automatic)

**Endpoint:** `GET /fhir-callback`

**Description:** Epic redirects here after patient authentication. This endpoint is called automatically by Epic's OAuth server.

**Query Parameters:**
- `code`: Authorization code
- `state`: CSRF protection token
- `session_id`: Session identifier

**Response:**
```json
{
  "status": "success",
  "message": "FHIR authentication successful",
  "session_id": "fhir_john_doe_abc123xyz",
  "patient_id": "egqBHVfQlt4Bw3XGXoxVxHg3",
  "scope": "patient/Patient.r patient/AllergyIntolerance.r ...",
  "expires_in": 3600
}
```

---

### 3. Fetch Patient FHIR Data

**Endpoint:** `POST /fhir-request`

**Description:** Retrieve comprehensive patient medical records from Epic FHIR.

**Request Body:**
```json
{
  "session_id": "fhir_john_doe_abc123xyz",
  "patient_id": "egqBHVfQlt4Bw3XGXoxVxHg3"  // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "session_id": "fhir_john_doe_abc123xyz",
  "data": {
    "patient_id": "egqBHVfQlt4Bw3XGXoxVxHg3",
    "patient": {
      "resourceType": "Patient",
      "id": "egqBHVfQlt4Bw3XGXoxVxHg3",
      "name": [{"family": "Lopez", "given": ["Elijah"]}],
      "gender": "male",
      "birthDate": "1982-05-01"
    },
    "allergies": {
      "resourceType": "Bundle",
      "entry": [
        {
          "resource": {
            "resourceType": "AllergyIntolerance",
            "code": {
              "coding": [{"display": "LACTOSE"}]
            }
          }
        }
      ]
    },
    "conditions": { /* ... */ },
    "medications": { /* ... */ },
    "observations": { /* ... */ },
    "procedures": { /* ... */ },
    "immunizations": { /* ... */ },
    "errors": []  // Any resources that failed to fetch
  }
}
```

---

### 4. Fetch Specific FHIR Resource

**Endpoint:** `POST /fhir-resource`

**Description:** Fetch a specific type of FHIR resource instead of all data.

**Request Body:**
```json
{
  "session_id": "fhir_john_doe_abc123xyz",
  "resource_type": "observations",
  "category": "vital-signs"  // Optional, for observations
}
```

**Resource Types:**
- `patient` - Demographics
- `allergies` - Allergies and intolerances
- `conditions` - Medical conditions
- `medications` - Medication requests
- `observations` - Vital signs, labs, social history (requires `category`)
- `procedures` - Procedure history
- `immunizations` - Immunization records

**Observation Categories:**
- `vital-signs` - Blood pressure, heart rate, temperature, etc.
- `laboratory` - Lab results, blood tests
- `social-history` - Smoking status, alcohol use

---

### 5. Logout / Clear Session

**Endpoint:** `POST /fhir-logout`

**Description:** Clear stored FHIR tokens and session data.

**Request Body:**
```json
{
  "session_id": "fhir_john_doe_abc123xyz"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "FHIR session cleared"
}
```

---

## Example Usage

### JavaScript/TypeScript Client

```typescript
// 1. Initiate FHIR login
const loginResponse = await fetch('https://localhost:8000/fhir-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ patient_username: 'john_doe' })
});

const loginData = await loginResponse.json();
const sessionId = loginData.session_id;

// 2. Redirect patient to Epic login
window.location.href = loginData.redirect_url;

// 3. After Epic redirects back to /fhir-callback, fetch patient data
const dataResponse = await fetch('https://localhost:8000/fhir-request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id: sessionId })
});

const patientData = await dataResponse.json();
console.log(patientData.data.allergies);
console.log(patientData.data.patient);
```

### Python Client

```python
import requests

# 1. Initiate login
response = requests.post('https://localhost:8000/fhir-login', json={
    'patient_username': 'john_doe'
})
data = response.json()
session_id = data['session_id']

# 2. Patient completes Epic login (manual browser step)
print(f"Visit: {data['redirect_url']}")

# 3. After callback, fetch data
response = requests.post('https://localhost:8000/fhir-request', json={
    'session_id': session_id
})
patient_data = response.json()
print(patient_data['data']['patient'])
```

---

## Configuration

### Environment Variables (.env)

```properties
# FHIR Server
FHIR_SERVER_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4

# OAuth Credentials
CLIENT_ID=1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
CLIENT_SECRET=  # Leave empty for public client

# Redirect URI
REDIRECT_URI=https://localhost:8000/fhir-callback

# Session Secret
SESSION_SECRET_KEY=your-secret-key-here

# FHIR Scopes
FHIR_SCOPES=patient/Patient.r patient/Observation.r patient/Condition.r patient/AllergyIntolerance.r patient/MedicationRequest.r patient/Procedure.r patient/Immunization.r launch/patient openid fhirUser
```

---

## Important Notes

### Epic Sandbox Limitations

1. **Patient Portal Restrictions**: Epic's patient portal (MyChart) has restricted access compared to provider/EHR launch. Some resources may return `403 Forbidden` even with valid scopes.

2. **Working Resources** (✅):
   - Patient demographics
   - AllergyIntolerance

3. **Restricted Resources** (⚠️ May return 403 in sandbox):
   - Observations
   - Conditions
   - Medications
   - Procedures
   - Immunizations

4. **Scope Format**: Epic uses abbreviated scope notation:
   - `.r` = read
   - `.s` = search
   - Example: `patient/Patient.r` instead of `patient/Patient.read`

### Production Deployment

For production:

1. **Use Redis/Database** for token storage instead of in-memory dictionary
2. **Implement token refresh** logic for long-lived sessions
3. **Add rate limiting** to prevent API abuse
4. **Use proper HTTPS certificates** (not self-signed)
5. **Implement audit logging** for HIPAA compliance
6. **Add encryption** for sensitive data at rest

---

## Error Handling

The API returns structured error responses:

```json
{
  "detail": "Session expired or invalid. Please re-authenticate via /fhir-login"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (session expired)
- `403` - Forbidden (scope not granted or Epic restriction)
- `404` - Not found (resource doesn't exist)
- `500` - Server error

---

## Security Considerations

1. **PKCE**: Uses Proof Key for Code Exchange to prevent authorization code interception
2. **State Parameter**: CSRF protection for OAuth flow
3. **HTTPS Only**: All OAuth callbacks must use HTTPS
4. **Short-lived Tokens**: Access tokens expire in 1 hour (configurable)
5. **Session Management**: Use secure session storage in production

---

## Testing

### Test Patient

Epic Sandbox provides test patients. Example:
- **Name**: Elijah Lopez
- **Patient ID**: `egqBHVfQlt4Bw3XGXoxVxHg3`
- **Epic Username**: (varies by sandbox)

### Test Flow

1. Start backend: `uvicorn main:app --reload --host localhost --port 8000`
2. Call `/fhir-login` with test patient username
3. Complete Epic login in browser
4. Call `/fhir-request` with returned session_id
5. Verify response contains patient data

---

## Troubleshooting

### "Session expired or invalid"
- **Solution**: Call `/fhir-login` again to get a new session

### "403 Forbidden" for observations
- **Cause**: Epic patient portal restrictions in sandbox
- **Solution**: Use provider/EHR launch for full access, or apply for production credentials

### "State mismatch" error
- **Cause**: CSRF protection triggered
- **Solution**: Ensure callback uses same session_id as login initiation

### "No patient ID available"
- **Cause**: OAuth flow didn't complete successfully
- **Solution**: Verify Epic login was completed and callback received

---

## Support

For Epic FHIR API documentation: https://fhir.epic.com/Documentation
For MediConnect issues: Contact development team
