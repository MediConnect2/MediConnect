# Patient vs Provider Login Setup

## Problem
When clicking "Login with EHR System", you were being directed to Epic's **practitioner/provider login portal**, which requires provider credentials (like FHIRTWO). Patient test credentials (like `fhircamila`, `fhirjason`) don't work there because it's the wrong login portal.

## Solution
We've added **two separate login endpoints**:

### 1. **Patient Portal Login** (`/patient-login`)
- **URL**: `https://localhost:8000/patient-login`
- **For**: Patient test accounts
- **Credentials**: Use Epic's patient test accounts like:
  - Username: `fhircamila` / Password: `epicepic1`
  - Username: `fhirjason` / Password: `epicepic1`
  - Username: `fhirderrick` / Password: `epicepic1`
- **Portal**: Epic MyChart patient portal
- **Use this for**: Testing patient data access

### 2. **Provider/Practitioner Login** (`/login`)
- **URL**: `https://localhost:8000/login`
- **For**: Provider/EMT accounts
- **Credentials**: Provider test accounts (like FHIRTWO)
- **Portal**: Epic provider/practitioner portal
- **Use this for**: Provider-level access (won't have patient context)

## What Changed

### Backend (`mediconnect-1/app/main.py`)
- ✅ Added new `/patient-login` endpoint that explicitly uses Epic's patient authorization URL
- ✅ Manually constructs OAuth URL to ensure patient portal is targeted
- ✅ Updated OAuth configuration to support public client (no client secret)

### Frontend (`mediconnect/src/app/fhir-access/page.tsx`)
- ✅ Added two separate login buttons:
  - **"Patient Portal Login"** (primary blue button)
  - **"Provider/Practitioner Login"** (secondary white button)
- ✅ Added helpful text explaining which button to use
- ✅ `handleLogin()` now redirects to `/patient-login`
- ✅ `handleProviderLogin()` redirects to `/login`

### Configuration (`.env`)
- ✅ Removed `CLIENT_SECRET` (empty for public client)
- ✅ Updated `CLIENT_ID` to your new patient-facing app ID
- ✅ Removed `launch/patient` scope (not needed for standalone patient apps)

## How to Use

### For Patient Data Access:
1. **Restart both servers**:
   ```powershell
   # Backend
   cd mediconnect-1
   python start_https.py

   # Frontend (in another terminal)
   cd mediconnect
   npm run dev
   ```

2. **Open the app**: Navigate to `http://localhost:3000/fhir-access`

3. **Click "Patient Portal Login"** (the blue button)

4. **Use patient credentials**:
   - Try `fhircamila` / `epicepic1`
   - Or other Epic sandbox patient accounts

5. **You should see**: Epic's MyChart patient login page (looks different from provider portal)

6. **After login**: Your app will automatically load patient data

### For Provider Access (if needed):
1. Click **"Provider/Practitioner Login"** (the white button)
2. Use provider credentials like `FHIRTWO` / `EpicFhir11!`
3. Note: You'll be logged in as a practitioner and won't have patient context

## Expected Behavior

### Patient Login ✅
- Redirects to Epic MyChart patient portal
- Patient credentials work (fhircamila, etc.)
- After login, `patient_id` will be set
- App automatically loads patient data
- Can view allergies, medications, conditions, etc.

### Provider Login ⚠️
- Redirects to Epic provider portal
- Provider credentials work (FHIRTWO, etc.)
- After login, `is_practitioner` flag is set to `true`
- `patient_id` will be `"PRACTITIONER_LOGIN"`
- App shows warning: "You authenticated with a practitioner account"
- Cannot load patient data without patient context

## Epic App Orchard Settings

Make sure your Epic app is configured as:
- **Application Audience**: Patients
- **OAuth 2.0 Client Type**: Public Client (No to "Is Confidential Client?")
- **Redirect URI**: `https://localhost:8000/callback`
- **Terms URL**: `http://localhost:3000/terms.html`
- **Privacy URL**: `http://localhost:3000/privacy.html`

## Troubleshooting

### Still seeing provider login?
- Make sure you clicked **"Patient Portal Login"** (not "Provider/Practitioner Login")
- Check browser console for redirect URL - should contain `/patient-login`

### Patient credentials not working?
- Verify you're using Epic's documented test patient accounts
- Check Epic's sandbox documentation for valid patient usernames
- Make sure your app is configured for "Patient" audience in Epic App Orchard

### "invalid_client" error?
- Confirm `CLIENT_SECRET` is empty in `.env`
- Verify Epic app is set to "Public Client" (not confidential)
- Check that `CLIENT_ID` matches your Epic patient-facing app

## Files Modified
- `mediconnect-1/app/main.py` - Added `/patient-login` endpoint
- `mediconnect-1/.env` - Removed client secret, updated scopes
- `mediconnect-1/app/core/config.py` - Added patient auth URL config
- `mediconnect/src/app/fhir-access/page.tsx` - Added dual login buttons
- `mediconnect/public/terms.html` - Terms and conditions page
- `mediconnect/public/privacy.html` - Privacy policy page

## Next Steps
1. Restart your backend server
2. Refresh your frontend
3. Click "Patient Portal Login"
4. Use patient test credentials
5. Enjoy accessing patient data! 🎉
