# FHIR Patient Registration - Testing Guide

## ✅ Implementation Complete!

The FHIR integration has been successfully integrated into the patient registration flow. Here's how to test it:

## Prerequisites

1. **Backend Running:**
   ```bash
   cd server_end
   uvicorn main:app --reload
   ```
   Should see: `Uvicorn running on http://127.0.0.1:8000`

2. **Frontend Running:**
   ```bash
   cd mediconnect
   npm run dev
   ```
   Should see: `Local: http://localhost:3000`

3. **Hospital Login:**
   - You need to be logged in as a hospital to access patient registration
   - Go to `/hospital-login` first

## Test Flow

### Step 1: Fill Basic Information

1. Go to: `http://localhost:3000/patient-register`
2. You should see a **2-step progress indicator** at the top:
   - **1. Basic Information** (blue, active)
   - **2. Connect Healthcare Provider** (gray, inactive)

3. Fill in the form:
   ```
   First Name: John
   Middle Name: (optional)
   Last Name: Doe
   Driver License ID: 12345678
   MediConnect Username: johndoe
   Password: yourpassword
   ```

4. Optional: Enable fingerprint login

5. Click **"Next: Connect Healthcare Provider"**

### What Happens:
- Frontend calls `POST /register` with basic info
- Backend creates patient record with `registration_status="pending_fhir"`
- Backend returns `session_id`
- UI moves to Step 2

### Step 2: FHIR Connection Screen

You should now see:
- **Progress indicator** shows Step 1 complete (✓), Step 2 active (blue)
- **Hospital emoji** 🏥
- **Title:** "Connect Your Healthcare Provider"
- **Description:** What happens next list
- **Two buttons:**
  - **"Connect Provider"** (blue) - Starts FHIR OAuth
  - **"Skip for Now"** (gray) - Skips FHIR connection

### Option A: Connect Provider (Full Flow)

1. Click **"Connect Provider"**

### What Happens:
- Frontend calls `POST /fhir-login` with your username
- Backend initiates OAuth flow, returns redirect URL
- Frontend stores session data in localStorage
- **Browser redirects to Epic login page**

2. **Epic Login** (Sandbox):
   - You'll be redirected to Epic's MyChart sandbox
   - Use Epic test credentials (e.g., Camila Lopez, DOB 5/30/1987)
   - Click "Sign In"
   - Authorize MediConnect to access your records

3. **Epic Redirects Back:**
   - Epic redirects to: `http://localhost:3000/fhir-callback?code=...&state=...`

4. **Callback Processing:**
   - You'll see a processing screen with spinning 🔄 emoji
   - Message: "Processing your healthcare provider connection..."
   - Then: "Exchanging authorization code..."
   - Then: "Fetching your medical records..."

### What Happens Behind the Scenes:
```
1. Frontend calls GET /fhir-callback (exchanges code for token)
2. Backend stores access token and patient ID
3. Frontend calls POST /patient/link-fhir
4. Backend fetches ALL FHIR data:
   - Patient demographics
   - Allergies
   - Conditions
   - Medications
   - Observations (vitals, labs, social history)
   - Procedures
   - Immunizations
5. Backend caches everything in MongoDB fhir_data field
6. Updates registration_status="completed"
```

5. **Success Screen:**
   - You'll see ✅ emoji
   - Message: "Connection Successful!"
   - Data summary showing how many allergies, conditions, etc. were imported
   - "Redirecting you to the dashboard..."
   - Auto-redirects after 3 seconds

### Option B: Skip Provider (Minimal Flow)

1. Click **"Skip for Now"**

### What Happens:
- Frontend calls `POST /patient/skip-fhir`
- Backend updates `registration_status="skipped_fhir"`
- Alert: "Registration completed without healthcare provider connection..."
- Redirects to home

## Verify in MongoDB

After completing registration, check MongoDB:

### Connect to MongoDB:
```bash
# Use your MongoDB connection string
mongosh "mongodb+srv://..."
```

### Check Patient Record:
```javascript
use mediconnect
db.patients.findOne({mediconnect_username: "johndoe"})
```

### If FHIR Connected:
```javascript
{
  _id: ObjectId("..."),
  mediconnect_username: "johndoe",
  hashed_password: "...",
  first_name: {ciphertext: "...", nonce: "..."},
  middle_name: {ciphertext: "...", nonce: "..."},
  last_name: {ciphertext: "...", nonce: "..."},
  driver_license_id: {ciphertext: "...", nonce: "..."},
  use_fingerprint: false,
  fingerprint_data: null,
  created_at: ISODate("2025-10-25T..."),
  
  // FHIR fields
  registration_status: "completed",
  fhir_session_id: "reg_johndoe_...",
  fhir_connected: true,
  fhir_patient_id: "erXuFYUfucBZaryVksYEcMg3",
  provider_name: "Epic Sandbox",
  fhir_scope: "patient/Patient.r patient/AllergyIntolerance.r ...",
  fhir_last_updated: ISODate("2025-10-25T..."),
  
  // Complete FHIR data cached!
  fhir_data: {
    patient: {
      resourceType: "Patient",
      id: "erXuFYUfucBZaryVksYEcMg3",
      name: [{
        use: "official",
        family: "Lopez",
        given: ["Camila"]
      }],
      gender: "female",
      birthDate: "1987-05-30",
      // ... more demographics
    },
    allergies: {
      resourceType: "Bundle",
      entry: [
        {
          resource: {
            resourceType: "AllergyIntolerance",
            clinicalStatus: {...},
            code: {
              coding: [{
                system: "http://www.nlm.nih.gov/research/umls/rxnorm",
                code: "1191",
                display: "Aspirin"
              }]
            },
            // ... more allergy details
          }
        }
        // ... more allergies
      ]
    },
    conditions: {
      // Medical conditions data
    },
    medications: {
      // Medication requests data
    },
    observations: {
      // Vital signs, lab results, social history
    },
    procedures: {
      // Procedure history
    },
    immunizations: {
      // Immunization records
    }
  }
}
```

### If FHIR Skipped:
```javascript
{
  ...
  registration_status: "skipped_fhir",
  fhir_connected: false,
  // No fhir_data field
}
```

## Testing Tips

### Test Multiple Scenarios:

1. **Full FHIR Flow:**
   - Complete registration with FHIR connection
   - Verify all data cached in MongoDB

2. **Skip FHIR Flow:**
   - Complete registration without FHIR
   - Verify status is "skipped_fhir"

3. **Error Handling:**
   - Try connecting FHIR without Epic credentials
   - Verify error messages display properly
   - Check callback error handling

4. **Different Epic Patients:**
   - Test with different Epic sandbox patients
   - Verify different medical records are cached

### Epic Sandbox Test Patients:

- **Camila Lopez** - Female, DOB: 5/30/1987
- **Derrick Lin** - Male, DOB: 2/8/1992
- **Christine Lee** - Female, DOB: 4/2/1978

(See Epic sandbox documentation for more test patients and credentials)

## Troubleshooting

### Issue: "Session expired or invalid"
**Solution:** FHIR tokens expire. Start registration from beginning.

### Issue: "Missing required parameters" in callback
**Solution:** 
- Don't close browser tab during OAuth flow
- Check browser privacy settings (localStorage must be enabled)

### Issue: 403 Forbidden for some FHIR resources
**Expected:** Epic sandbox patient portal restricts access to some resources. This is normal. The code gracefully handles these errors.

### Issue: Callback page not loading
**Solution:**
- Check that Next.js is running on port 3000
- Verify `/fhir-callback/page.tsx` exists
- Check browser console for errors

### Issue: Backend errors
**Solution:**
```bash
# Check backend logs
cd server_end
uvicorn main:app --reload --log-level debug
```

## Next Steps After Testing

Once registration works:

1. **Test Patient Login:**
   - Login with the registered patient
   - Verify `_build_patient_response` returns FHIR data summary

2. **Display Medical Records:**
   - Create patient dashboard page
   - Show allergies, conditions, medications from `fhir_data`

3. **Add Refresh Functionality:**
   - Add "Refresh Records" button in patient profile
   - Re-fetch FHIR data to update cache

4. **Production Deployment:**
   - Replace Epic sandbox credentials with production
   - Update FHIR_SERVER_URL to production endpoint
   - Implement Redis for token storage
   - Add token refresh logic

## Success Criteria

✅ Step 1 form collects basic info without portal fields  
✅ Progress indicator shows current step  
✅ Step 2 shows FHIR connection options  
✅ "Connect Provider" redirects to Epic login  
✅ Epic callback processes successfully  
✅ FHIR data is fetched and cached in MongoDB  
✅ Success screen shows data summary  
✅ "Skip for Now" completes registration without FHIR  
✅ MongoDB contains correct `registration_status`  
✅ All FHIR data cached in `fhir_data` field  

## Documentation

- **Complete Guide:** `FHIR_REGISTRATION_GUIDE.md`
- **Backend Implementation:** `server_end/main.py`, `fhir_service.py`, `fhir_oauth.py`
- **Frontend Implementation:** 
  - `mediconnect/src/app/patient-register/page.tsx`
  - `mediconnect/src/app/fhir-callback/page.tsx`

---

**Ready to test! 🚀**

Start by filling out the registration form and clicking "Next: Connect Healthcare Provider"!
