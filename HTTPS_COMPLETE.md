# HTTPS Setup Complete ✅

## Current Status

✅ **Backend (FastAPI)**: Running on `https://localhost:8000` with SSL
✅ **Frontend (Next.js)**: Running on `http://localhost:3000` and configured to use HTTPS backend
✅ **Environment**: Configured with `REDIRECT_URI=https://localhost:8000/callback`

## What Changed

### 1. Backend Configuration
- Updated `mediconnect-1/app/core/config.py` to read `REDIRECT_URI` from environment
- Set `REDIRECT_URI=https://localhost:8000/callback` in `mediconnect-1/.env`
- Generated SSL certificates in `mediconnect-1/certs/` (cert.pem, key.pem)
- Started uvicorn with `--ssl-keyfile` and `--ssl-certfile` flags

### 2. Frontend Configuration
- Created `mediconnect/.env.local` with `NEXT_PUBLIC_API_BASE=https://localhost:8000`
- Updated `mediconnect/src/app/fhir-access/page.tsx` to use the environment variable instead of hardcoded URLs

## How to Run

### Backend (Terminal 1)
```powershell
cd mediconnect-1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
```

### Frontend (Terminal 2)
```powershell
cd mediconnect
npm run dev
```

## Testing the OAuth Flow

1. **Open your browser**: Navigate to `http://localhost:3000`

2. **Go to FHIR Access**: Navigate to `http://localhost:3000/fhir-access`

3. **Click "Login with EHR System"**: This will redirect you to Epic's authorization page

4. **Epic Login**: Complete the Epic authentication process

5. **Accept SSL Certificate**: 
   - After Epic authentication, you'll be redirected to `https://localhost:8000/callback`
   - Your browser will show a **security warning** (self-signed certificate)
   - Click **"Advanced"** → **"Proceed to localhost (unsafe)"**
   - This is safe for local development

6. **Success**: You should be redirected back to the frontend with patient data

## Epic App Registration Checklist

Make sure your Epic FHIR app has these exact settings:

### Required Settings
- ✅ **Application Type**: Confidential Client
- ✅ **OAuth 2.0 Grant Type**: Authorization Code
- ✅ **Redirect URI**: `https://localhost:8000/callback` (EXACT match required)

### Required Scopes (Move from "Available" to "Selected")
- ✅ `openid`
- ✅ `fhirUser`
- ✅ `launch/patient`
- ✅ `patient/Patient.read`
- ✅ `patient/Observation.read`
- ✅ `patient/Condition.read`
- ✅ `patient/AllergyIntolerance.read`
- ✅ `patient/MedicationRequest.read`
- ✅ `patient/Procedure.read`
- ✅ `patient/Immunization.read`

## Troubleshooting

### "ERR_EMPTY_RESPONSE" Error
- Make sure backend is running with HTTPS (check terminal output for `https://`)
- Verify frontend is using HTTPS URLs (check `.env.local` exists)
- Restart Next.js dev server if you just created `.env.local`

### "OAuth2 Error" from Epic
- Verify redirect URI in Epic matches exactly: `https://localhost:8000/callback`
- Check all scopes are in "Selected" column, not just "Available"
- Ensure app is saved as "Confidential Client"
- Verify `CLIENT_ID` and `CLIENT_SECRET` in `.env` match Epic

### Browser SSL Warning
- This is **normal** for self-signed certificates
- Click "Advanced" → "Proceed to localhost"
- You'll need to do this once per browser session

### Session/CORS Issues
- Make sure `credentials: 'include'` is in all fetch calls (already updated)
- Verify CORS_ORIGINS includes both HTTP and HTTPS (already configured)

## Next Steps

1. Update Epic app registration with HTTPS redirect URI
2. Test the OAuth flow end-to-end
3. If successful, you should see patient data from Epic FHIR API

## Notes

- Self-signed certificates are for **development only**
- For production, use proper SSL certificates (Let's Encrypt, etc.)
- The backend listens on `0.0.0.0:8000` (all interfaces) for easier testing
- CORS is configured to allow requests from both HTTP and HTTPS frontend origins
