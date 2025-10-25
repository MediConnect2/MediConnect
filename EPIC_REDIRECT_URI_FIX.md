# Epic OAuth Redirect URI Fix

## Problem
Epic MyChart was showing "The request is invalid" error when trying to connect FHIR during patient registration.

## Root Cause
**Redirect URI mismatch** between what was registered with Epic and what the application was using:

- **Epic Registration**: `https://localhost:8000/callback`
- **Application was using**: `https://localhost:8000/fhir-callback` ❌

Epic validates the `redirect_uri` parameter against what's registered in their developer portal. Any mismatch results in "The request is invalid" error.

## Solution
Changed all redirect URI references from `/fhir-callback` to `/callback` to match Epic's registration.

### Files Modified

1. **`server_end/.env`**
   - Changed: `REDIRECT_URI=https://localhost:8000/callback`

2. **`server_end/fhir_oauth.py`**
   - Updated default redirect URI in `__init__` method
   - Changed: `self.redirect_uri = os.getenv("REDIRECT_URI", "https://localhost:8000/callback")`

3. **`server_end/main.py`**
   - Changed endpoint from `@app.get("/fhir-callback")` to `@app.get("/callback")`

4. **Frontend: Renamed directory**
   - Renamed: `mediconnect/src/app/fhir-callback/` → `mediconnect/src/app/callback/`

5. **`mediconnect/src/app/callback/page.tsx`**
   - Updated API call to use `/callback` instead of `/fhir-callback`

## Additional Fixes Applied

### SSL Certificate Trust Issue
- **Problem**: Browser didn't trust newly generated SSL certificates
- **Solution**: Copied existing trusted certificates from `mediconnect-1/certs/` to `server_end/certs/`
- **Why**: Browser already trusted these certificates from previous testing

### File Corruption
- **Problem**: `server_end/fhir_oauth.py` was 0 bytes (empty file)
- **Solution**: Restored the complete `FHIROAuthHandler` class implementation

## Testing

After applying these fixes:

1. ✅ Backend starts successfully with HTTPS
2. ✅ SSL certificates are trusted by browser
3. ✅ OAuth redirect URI matches Epic registration
4. ✅ Patient registration with FHIR connection should work

## Epic OAuth Flow (After Fix)

1. User fills out patient registration form
2. User clicks "Connect to Healthcare Provider"
3. Frontend calls `POST /fhir-login` with username
4. Backend generates OAuth URL with **correct redirect URI**: `https://localhost:8000/callback`
5. User redirects to Epic MyChart login
6. Epic authenticates user and redirects back to `https://localhost:8000/callback?code=...&state=...`
7. Backend exchanges code for access token
8. Frontend fetches and stores FHIR data

## Important Notes

- The redirect URI **MUST** exactly match what's registered in Epic's developer portal
- Any change to the redirect URI requires updating Epic's app configuration
- The redirect URI must use HTTPS (not HTTP) for production Epic instances
- Self-signed certificates work for development but require manual browser trust

## Verification

To verify the fix is working, check backend logs when initiating FHIR login. You should see:

```
🔐 Initiating patient login | session=fhir_... | client_id=1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
📋 OAuth Parameters:
   - response_type: code
   - client_id: 1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
   - redirect_uri: https://localhost:8000/callback  ✅ CORRECT
   - scope: patient/Patient.r patient/Observation.r ...
   - aud: https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
   - code_challenge_method: S256
```

The `redirect_uri` parameter should match Epic's registration exactly.
