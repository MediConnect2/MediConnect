# FHIR Patient Registration Integration Guide

## Overview

This guide describes the new 2-step patient registration flow that integrates FHIR OAuth to automatically import medical records from healthcare providers (Epic MyChart, Kaiser, UCSF, etc.).

## Architecture

### Registration Flow

```
Patient Registration Flow:
1. Patient fills basic info (name, MediConnect account, driver license)
2. Backend creates provisional patient record with status="pending_fhir"
3. Patient clicks "Connect Healthcare Provider"
4. Frontend initiates FHIR OAuth login
5. Patient redirected to Epic/provider login page
6. Patient authorizes MediConnect to access medical records
7. Epic redirects to /fhir-callback with authorization code
8. Frontend exchanges code for access token
9. Frontend fetches comprehensive FHIR data
10. Frontend calls /patient/link-fhir to cache data in MongoDB
11. Registration complete!
```

## Backend Implementation (✅ COMPLETED)

### Modified Files

#### 1. `server_end/main.py`

**Modified `/register` endpoint:**
- Removed `portal_username`, `portal_password`, `provider_portal_name` fields
- Now only accepts basic patient info
- Creates provisional record with `registration_status="pending_fhir"`
- Returns `session_id` for FHIR OAuth flow

**New Endpoints:**

##### `/patient/link-fhir` (POST)
Links FHIR data to patient record after successful OAuth.

**Request:**
```json
{
  "mediconnect_username": "johndoe",
  "fhir_session_id": "reg_johndoe_abc123..."
}
```

**Response:**
```json
{
  "status": "success",
  "message": "FHIR data successfully linked",
  "provider_name": "Epic Sandbox",
  "patient_id": "erXuFYUfucBZaryVksYEcMg3",
  "data_summary": {
    "demographics": true,
    "allergies": 3,
    "conditions": 5,
    "medications": 2,
    "observations": 10,
    "procedures": 1,
    "immunizations": 4
  }
}
```

##### `/patient/skip-fhir` (POST)
Allows patients to complete registration without connecting healthcare provider.

**Request:**
```json
{
  "mediconnect_username": "johndoe"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Registration completed without FHIR connection"
}
```

**Updated `_build_patient_response` function:**
- Now checks if patient has FHIR data connected
- Returns FHIR data summary if available
- Falls back to legacy portal credentials if not using FHIR

### MongoDB Schema Updates

**New Patient Document Fields:**
```javascript
{
  // Existing fields
  "mediconnect_username": "johndoe",
  "hashed_password": "...",
  "first_name": {encrypted},
  "middle_name": {encrypted},
  "last_name": {encrypted},
  "driver_license_id": {encrypted},
  "use_fingerprint": false,
  "fingerprint_data": null,
  "created_at": ISODate("2025-10-25T..."),
  
  // NEW FHIR fields
  "registration_status": "pending_fhir",  // or "completed", "skipped_fhir"
  "fhir_session_id": "reg_johndoe_abc123...",
  "fhir_connected": false,  // true after successful connection
  "fhir_patient_id": "erXuFYUfucBZaryVksYEcMg3",  // Epic patient ID
  "provider_name": "Epic Sandbox",
  "fhir_scope": "patient/Patient.r patient/AllergyIntolerance.r ...",
  "fhir_last_updated": ISODate("2025-10-25T..."),
  "fhir_data": {
    // Complete FHIR resource data
    "patient": {...},  // Demographics
    "allergies": {...},  // AllergyIntolerance resources
    "conditions": {...},  // Condition resources
    "medications": {...},  // MedicationRequest resources
    "observations": {...},  // Observation resources (vitals, labs, social history)
    "procedures": {...},  // Procedure resources
    "immunizations": {...}  // Immunization resources
  }
}
```

## Frontend Implementation (⚠️ MANUAL STEP REQUIRED)

### Created Files

#### 1. `/fhir-callback/page.tsx` (✅ COMPLETED)

This page handles the OAuth callback after Epic redirects the patient back.

**What it does:**
1. Extracts `code` and `state` from URL query parameters
2. Retrieves `fhir_session_id` and `mediconnect_username` from localStorage
3. Calls backend `/fhir-callback` to exchange code for token
4. Calls backend `/patient/link-fhir` to fetch and cache FHIR data
5. Shows success/error status with data summary
6. Redirects to home after 3 seconds

### Files to Update

#### 2. `/patient-register/page.tsx` (⚠️ NEEDS MANUAL UPDATE)

You need to update this file to implement the 2-step registration flow.

**Changes needed:**

1. **Remove portal fields from form state:**
```typescript
const [form, setForm] = useState({
    mediconnect_username: '',
    password: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    driver_license_id: '',
    use_fingerprint: false,
    fingerprint_data: ''
    // REMOVED: portal_username, portal_password, provider_portal_name
});
```

2. **Add step tracking:**
```typescript
const [step, setStep] = useState(1); // 1 = basic info, 2 = FHIR connection
const [sessionId, setSessionId] = useState('');
```

3. **Rename handleSubmit to handleNextStep:**
```typescript
const handleNextStep = async(e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
        const res = await fetch('http://localhost:8000/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(form)
        });
        
        if (res.ok) {
            const data = await res.json();
            setSessionId(data.session_id);
            setStep(2); // Move to FHIR connection step
        } else {
            // Handle error
        }
    } catch (error) {
        console.error("Registration error:", error);
    } finally {
        setLoading(false);
    }
};
```

4. **Add FHIR connection handler:**
```typescript
const handleConnectFHIR = async () => {
    setLoading(true);
    setError('');

    try {
        const res = await fetch('http://localhost:8000/fhir-login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                patient_username: form.mediconnect_username
            })
        });

        if (res.ok) {
            const data = await res.json();
            const fhirSessionId = data.session_id;
            const redirectUrl = data.redirect_url;

            // Store session info for callback
            localStorage.setItem('fhir_session_id', fhirSessionId);
            localStorage.setItem('mediconnect_username', form.mediconnect_username);

            // Redirect to Epic login
            window.location.href = redirectUrl;
        }
    } catch (error) {
        console.error("FHIR connection error:", error);
    } finally {
        setLoading(false);
    }
};
```

5. **Add skip handler:**
```typescript
const handleSkipFHIR = async () => {
    try {
        await fetch('http://localhost:8000/patient/skip-fhir', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                mediconnect_username: form.mediconnect_username
            })
        });
        alert("Registration completed. You can connect your provider later.");
        router.push('/');
    } catch (error) {
        console.error("Skip error:", error);
    }
};
```

6. **Update the render to show step-based UI:**
```tsx
{step === 1 ? (
    <form onSubmit={handleNextStep}>
        {/* Personal Information Section */}
        {/* MediConnect Account Section */}
        {/* Fingerprint Section (optional) */}
        {/* Remove Healthcare Portal Section */}
        
        <button type="submit">
            {loading ? 'Creating Account...' : 'Next: Connect Healthcare Provider'}
        </button>
    </form>
) : (
    <div>
        {/* FHIR Connection Step */}
        <h2>Connect Your Healthcare Provider</h2>
        <p>Connect your provider account to import medical records...</p>
        
        <button onClick={handleConnectFHIR}>Connect Provider</button>
        <button onClick={handleSkipFHIR}>Skip for Now</button>
    </div>
)}
```

## Testing the Flow

### Prerequisites
1. Backend server running: `cd server_end && uvicorn main:app --reload`
2. Frontend running: `cd mediconnect && npm run dev`
3. Epic sandbox test credentials ready

### Test Steps

1. **Start Registration:**
   - Go to patient registration page
   - Fill in basic information:
     - First Name: Your name
     - Last Name: Your last name
     - Driver License ID: Any numbers
     - MediConnect Username: Choose unique username
     - Password: Choose password
   - Click "Next: Connect Healthcare Provider"

2. **Connect Provider:**
   - You should see step 2 with FHIR connection options
   - Click "Connect Provider"
   - You'll be redirected to Epic login (MyChart sandbox)

3. **Epic Login:**
   - Use Epic sandbox test credentials
   - Authorize MediConnect to access records
   - Epic redirects to `http://localhost:3000/fhir-callback?code=...&state=...`

4. **Callback Processing:**
   - Frontend automatically processes callback
   - Exchanges code for token
   - Fetches comprehensive FHIR data
   - Caches data in MongoDB
   - Shows success message with data summary

5. **Verify in MongoDB:**
   ```javascript
   db.patients.findOne({mediconnect_username: "your_username"})
   ```
   
   Should show:
   ```javascript
   {
     ...
     "registration_status": "completed",
     "fhir_connected": true,
     "fhir_patient_id": "erXuFYUfucBZaryVksYEcMg3",
     "provider_name": "Epic Sandbox",
     "fhir_data": {
       "patient": {...},
       "allergies": {...},
       // ... more data
     }
   }
   ```

### Test Skip Flow

1. Follow steps 1-2 above
2. Instead of clicking "Connect Provider", click "Skip for Now"
3. Should see alert and redirect to home
4. Verify in MongoDB:
   ```javascript
   {
     ...
     "registration_status": "skipped_fhir",
     "fhir_connected": false
   }
   ```

## Environment Configuration

### Backend `.env` (Already configured)
```properties
FHIR_SERVER_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
CLIENT_ID=1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
CLIENT_SECRET=
REDIRECT_URI=https://localhost:8000/fhir-callback
SESSION_SECRET_KEY=drkcXZX2R5Xq8dkkqvvx4LvDqe8XoRkaSTnDZxmRjew
FHIR_SCOPES=patient/Patient.r patient/Observation.r patient/Condition.r patient/AllergyIntolerance.r patient/MedicationRequest.r patient/Procedure.r patient/Immunization.r launch/patient openid fhirUser
```

## API Endpoint Summary

### Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/register` | POST | Create patient account (step 1) |
| `/fhir-login` | POST | Initiate FHIR OAuth flow |
| `/fhir-callback` | GET | Handle OAuth callback from Epic |
| `/patient/link-fhir` | POST | Link FHIR data to patient record |
| `/patient/skip-fhir` | POST | Skip FHIR connection |
| `/patient/login` | POST | Patient login (updated to handle FHIR patients) |

### Frontend Pages

| Page | Purpose |
|------|---------|
| `/patient-register` | 2-step registration form |
| `/fhir-callback` | Handle Epic OAuth redirect |

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Patient Registration Flow                     │
└─────────────────────────────────────────────────────────────────┘

Step 1: Basic Info
┌──────────────┐
│   Patient    │
│    Enters    │──────┐
│  Basic Info  │      │
└──────────────┘      │
                      ▼
              POST /register
                      │
                      ▼
            ┌─────────────────┐
            │   MongoDB       │
            │ Create Patient  │
            │ status=pending  │
            └─────────────────┘
                      │
                      ▼
            Return session_id
                      │
                      ▼
        Frontend: Move to Step 2

Step 2: FHIR Connection
┌──────────────┐
│   Patient    │
│    Clicks    │──────┐
│   Connect    │      │
└──────────────┘      │
                      ▼
           POST /fhir-login
                      │
                      ▼
        Redirect to Epic Login
                      │
                      ▼
      ┌──────────────────────┐
      │  Epic MyChart Login  │
      │   Patient Enters     │
      │   Credentials        │
      └──────────────────────┘
                      │
                      ▼
        Patient Authorizes App
                      │
                      ▼
    Epic Redirects to /fhir-callback
         with code & state
                      │
                      ▼
      ┌──────────────────────┐
      │  Frontend Callback   │
      │  Page.tsx            │
      └──────────────────────┘
                      │
                      ├──────► GET /fhir-callback
                      │        Exchange code for token
                      │
                      └──────► POST /patient/link-fhir
                               Fetch FHIR data
                                      │
                                      ▼
                            ┌─────────────────┐
                            │    FHIR API     │
                            │  Fetch Patient  │
                            │  Fetch Allergies│
                            │  Fetch Conditions│
                            │  Fetch Meds     │
                            │  etc...         │
                            └─────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │   MongoDB       │
                            │  Update Patient │
                            │  fhir_data=...  │
                            │  status=completed│
                            └─────────────────┘
                                      │
                                      ▼
                              Registration Complete!
```

## Troubleshooting

### Common Issues

1. **"Session expired or invalid" error:**
   - FHIR session tokens expire after 1 hour
   - Patient needs to restart registration process
   - Solution: Implement token refresh in production

2. **"Missing required parameters" in callback:**
   - localStorage cleared or expired
   - Solution: Check browser privacy settings
   - Don't close tab during OAuth flow

3. **403 Forbidden errors for some FHIR resources:**
   - Epic sandbox patient portal restricts access
   - Only Patient and AllergyIntolerance work in sandbox
   - This is expected behavior (see IMPLEMENTATION_SUMMARY.md)

4. **CORS errors:**
   - Ensure frontend runs on `localhost:3000`
   - Backend has CORS middleware enabled
   - Check that allow_origins includes frontend URL

### Debug Steps

1. **Check backend logs:**
   ```bash
   cd server_end
   uvicorn main:app --reload --log-level debug
   ```

2. **Check MongoDB:**
   ```javascript
   db.patients.find({mediconnect_username: "test"}).pretty()
   ```

3. **Check browser console:**
   - Open DevTools → Console
   - Look for error messages during callback
   - Check Network tab for failed API calls

4. **Verify localStorage:**
   ```javascript
   console.log(localStorage.getItem('fhir_session_id'));
   console.log(localStorage.getItem('mediconnect_username'));
   ```

## Production Considerations

1. **Token Storage:**
   - Replace in-memory `token_store` with Redis or database
   - Implement token refresh logic
   - Add token expiration handling

2. **Security:**
   - Use HTTPS for all endpoints
   - Validate redirect URIs strictly
   - Implement rate limiting on OAuth endpoints
   - Add HIPAA-compliant audit logging

3. **Error Handling:**
   - Gracefully handle Epic API failures
   - Provide user-friendly error messages
   - Allow re-trying FHIR connection from profile

4. **Data Sync:**
   - Implement periodic FHIR data refresh
   - Add "Refresh Records" button in patient profile
   - Track last_updated timestamps

5. **Epic Production:**
   - Update CLIENT_ID to production credentials
   - Change FHIR_SERVER_URL to production endpoint
   - Test with real patient portals

## Next Steps

1. ✅ Backend implementation complete
2. ✅ FHIR callback page created
3. ⚠️ **Update patient-register/page.tsx** (see section above)
4. ⏳ Test end-to-end flow
5. ⏳ Add "Connect Provider" option in patient profile (for users who skipped)
6. ⏳ Implement FHIR data refresh functionality
7. ⏳ Add data visualization in patient dashboard

## Files Modified/Created

### Backend (server_end/)
- ✅ `main.py` - Updated `/register`, added `/patient/link-fhir`, `/patient/skip-fhir`
- ✅ `fhir_service.py` - Already exists, no changes needed
- ✅ `fhir_oauth.py` - Already exists, no changes needed
- ✅ `.env` - Already configured

### Frontend (mediconnect/src/app/)
- ✅ `fhir-callback/page.tsx` - Created new callback handler page
- ⚠️ `patient-register/page.tsx` - **NEEDS MANUAL UPDATE** (see guide above)

## Questions?

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review backend logs for errors
3. Verify MongoDB document structure
4. Test with Epic sandbox credentials

The implementation is 90% complete - just need to update the patient registration frontend page!
