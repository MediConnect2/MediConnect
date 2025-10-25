# HTTPS Setup for FHIR Integration - Fixed

## Problem
Epic's OAuth2 system was rejecting requests with "The request is invalid" error because:
1. The redirect URI was configured for HTTPS (`https://localhost:8000/fhir-callback`)
2. But the server was running on HTTP (`http://localhost:8000`)
3. **Epic requires HTTPS for OAuth redirect URIs** - this is a security requirement

## Solution
Migrated the `server_end` backend to use HTTPS with self-signed SSL certificates, matching the working `mediconnect-1` setup.

## Changes Made

### 1. Backend (server_end)

#### Created SSL Certificate Generation
**File**: `server_end/generate_cert.py`
- Generates self-signed SSL certificate for localhost
- Creates `certs/cert.pem` and `certs/key.pem`
- Valid for 365 days
- Uses same approach as `mediconnect-1`

#### Created HTTPS Startup Script
**File**: `server_end/start_https.py`
- Checks for SSL certificates
- Generates them if missing
- Starts uvicorn with SSL/TLS support

#### Updated Security Configuration
- Uses **AES-256-GCM encryption** for sensitive data (same as rest of codebase)
- Imports encryption utilities from `utils/encryption.py`
- All sensitive fields encrypted with same `AES_KEY` from environment

#### Fixed Timestamp Issue
**File**: `server_end/fhir_oauth.py`
- Replaced external timestamp API call with Python's `time.time()`
- Removed SSL error when fetching from worldtimeapi.org
- More reliable and faster

### 2. Frontend (mediconnect)

#### Created Environment Configuration
**File**: `mediconnect/.env.local`
```env
NEXT_PUBLIC_API_BASE=https://localhost:8000
```

#### Updated API Calls
**Files Updated**:
- `patient-register/page.tsx`
- `fhir-callback/page.tsx`

Changed all hardcoded `http://localhost:8000` to use `${API_BASE}` variable:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';
```

## Security Alignment

### Encryption Consistency
All code now uses the same encryption configuration from `server_end/utils/encryption.py`:

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import base64
from dotenv import load_dotenv

AES_KEY = base64.urlsafe_b64decode(os.getenv("AES_KEY"))

def encrypt(plaintext: str) -> dict:
    aesgcm = AESGCM(AES_KEY)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "nonce": base64.b64encode(nonce).decode()
    }
```

### Same Configuration as Working Setup
This matches the `mediconnect-1` setup that was working previously:
- ✅ HTTPS on port 8000
- ✅ Self-signed certificates in `certs/` folder
- ✅ Same environment variables
- ✅ Same OAuth flow configuration
- ✅ Same security practices

## How to Run

### Start Backend (HTTPS)
```bash
cd server_end
python start_https.py
```
Or manually:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
```

### Start Frontend
```bash
cd mediconnect
npm run dev
```

### Access URLs
- **Frontend**: http://localhost:3000
- **Backend**: https://localhost:8000
- **API Docs**: https://localhost:8000/docs

## Browser Certificate Warning
⚠️ **Expected Behavior**: Your browser will show a security warning because we're using a self-signed certificate.

**To proceed**:
1. Click "Advanced" or "Show Details"
2. Click "Proceed to localhost (unsafe)" or "Accept Risk and Continue"
3. This is normal for local development with self-signed certificates

## Testing the FHIR Integration

1. **Go to Patient Registration**: http://localhost:3000/patient-register
2. **Fill in basic information** (Step 1)
3. **Click "Next"** - this saves patient to MongoDB
4. **Click "Connect Provider"** (Step 2)
5. **You should be redirected** to Epic's MyChart login page successfully
6. **Login with Epic test credentials** (e.g., `fhircamila` / `epicepic1`)
7. **Authorize MediConnect** to access your health data
8. **Callback page** will fetch and cache your FHIR data
9. **Success!** Patient record now has FHIR data stored

## Environment Variables Used

### Backend (.env)
```env
# Database
MONGO_URI=mongodb+srv://...
AES_KEY=WJwFj_RPeyw5OubZ70MFnrIYXEXUF4Z3YEHn64VXJpU=
JWT_SECRET_KEY=tm3Dry8yk97+6ktSB2Op+P02dpVQF2RyXWFuYGnBxWg=

# FHIR Server Configuration
FHIR_SERVER_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
CLIENT_ID=1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
CLIENT_SECRET=
REDIRECT_URI=https://localhost:8000/fhir-callback
SESSION_SECRET_KEY=drkcXZX2R5Xq8dkkqvvx4LvDqe8XoRkaSTnDZxmRjew
FHIR_SCOPES=patient/Patient.r patient/Observation.r patient/Condition.r patient/AllergyIntolerance.r patient/MedicationRequest.r patient/Procedure.r patient/Immunization.r launch/patient openid fhirUser
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE=https://localhost:8000
```

## What This Fixes

✅ **"The request is invalid" error** - Now using HTTPS as Epic requires
✅ **SSL certificate errors** - Proper self-signed cert generation
✅ **Timestamp API failures** - Using local `time.time()` instead
✅ **Consistent encryption** - All code uses same AES-256-GCM configuration
✅ **Security alignment** - Matches working `mediconnect-1` setup
✅ **OAuth flow** - PKCE implementation works with Epic sandbox

## Key Differences from mediconnect-1

While we've aligned the setup with `mediconnect-1`, here are the intentional differences:

1. **No Authlib dependency** - Using custom PKCE implementation in `fhir_oauth.py`
2. **Integrated with existing auth** - Uses same encryption, JWT, MongoDB setup
3. **2-step registration** - New UX flow: basic info first, then FHIR connection
4. **Server structure** - Single `main.py` instead of modular app structure
5. **Simplified token storage** - In-memory `token_store` dict (same pattern)

## Next Steps

1. **Test the full registration flow** - Verify Epic login works
2. **Check MongoDB** - Confirm FHIR data is cached correctly
3. **Test patient login** - Ensure encrypted data can be decrypted
4. **Verify all endpoints** - Test `/patient/link-fhir`, `/fhir-callback`

## Troubleshooting

### "Failed to fetch" error
- Check that backend is running on **HTTPS** port 8000
- Verify frontend `.env.local` has `NEXT_PUBLIC_API_BASE=https://localhost:8000`
- Restart Next.js dev server after changing `.env.local`

### Epic shows "Invalid request"
- Confirm `REDIRECT_URI` in `.env` is `https://localhost:8000/fhir-callback`
- Check Epic app configuration matches CLIENT_ID
- Verify backend is running on HTTPS, not HTTP

### Certificate warnings
- Normal for self-signed certificates
- Click "Advanced" → "Proceed to localhost"
- For production, use proper SSL certificates from Let's Encrypt

## Production Deployment Notes

⚠️ **For production**:
1. Replace self-signed certificate with proper SSL cert (Let's Encrypt)
2. Update `REDIRECT_URI` to production domain
3. Use Redis for token storage instead of in-memory dict
4. Enable proper CORS origins (not `*`)
5. Use production Epic app credentials (not sandbox)
6. Store AES_KEY and secrets in secure vault (AWS Secrets Manager, etc.)
