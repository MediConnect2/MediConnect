# 🔴 CRITICAL: Fix Epic App Scopes to Enable Observations

## Problem
Your Epic app is **rejecting most FHIR resource requests** with 403 Forbidden errors. This means the scopes were not properly configured in your Epic app registration.

## Evidence from Logs
```
✅ Patient demographics - WORKS
✅ Allergies - WORKS
❌ Conditions - 403 FORBIDDEN (scope not granted)
❌ Medications - 403 FORBIDDEN (scope not granted)
❌ Observations/Vital Signs - 403 FORBIDDEN (scope not granted)
❌ Laboratory Observations - 403 FORBIDDEN (scope not granted)
❌ Procedures - 403 FORBIDDEN (scope not granted)
❌ Immunizations - 403 FORBIDDEN (scope not granted)
```

## Root Cause
When you registered your Epic app, you likely:
1. Did not select all the required scopes in the "Scopes" section
2. Left scopes in the "Available" column instead of moving them to "Selected"
3. The scopes are not enabled for your client ID

## 🔧 IMMEDIATE FIX (Follow These Steps)

### Step 1: Log Into Epic FHIR Portal
1. Go to: **https://fhir.epic.com/Developer/Apps**
2. Sign in with your Epic developer account
3. Find your app with Client ID: `1a3aabaa-38dd-4a03-ac3a-38de1c40cae2`
4. Click **"Edit Application"**

### Step 2: Navigate to Scopes Section
Look for a section called:
- **"FHIR Scopes"** or
- **"OAuth 2.0 Scopes"** or
- **"API Access"**

You should see TWO columns:
- **Left column**: "Available Scopes"
- **Right column**: "Selected Scopes" (these are the ones your app can use)

### Step 3: Move ALL These Scopes to "Selected" Column

**CRITICAL**: You must move each scope from "Available" to "Selected". Click the scope in the Available column and click the arrow (→) or "Add" button to move it to Selected.

#### Required Scopes (Move ALL of these):
- ✅ `openid`
- ✅ `fhirUser`
- ✅ `patient/Patient.read`
- ✅ `patient/Observation.read` ⚠️ **THIS IS THE MISSING ONE FOR SMOKING HISTORY**
- ✅ `patient/Condition.read`
- ✅ `patient/AllergyIntolerance.read`
- ✅ `patient/MedicationRequest.read`
- ✅ `patient/Procedure.read`
- ✅ `patient/Immunization.read`

#### Special Notes:
- **`launch/patient`**: If available in Epic, add it. If not available, skip it (some sandboxes don't support it)
- **Observation.read is CRITICAL** - This is what retrieves smoking history, vital signs, lab results, etc.

### Step 4: Verify Redirect URI
While you're in the Epic app settings, double-check:

**OAuth 2.0 Redirect URIs:**
```
https://localhost:8000/callback
```

Make sure:
- ✅ Uses `https://` (not http)
- ✅ Uses `localhost` (not 127.0.0.1)
- ✅ Port `:8000` is included
- ✅ Path is `/callback` (no trailing slash)

### Step 5: Verify Application Type
Make sure your app is configured as:
- ✅ **"Public Client (PKCE)"** or **"Native App"** 
  - This is correct for patient-facing apps
  - Your CLIENT_SECRET is empty, which confirms this

### Step 6: Save Changes
1. Scroll to the bottom of the page
2. Click **"Save"** or **"Save & Build"**
3. Wait for the confirmation message
4. **IMPORTANT**: Some changes may take a few minutes to propagate

### Step 7: Clear Your Session and Re-authenticate
After saving the Epic app changes:

1. **Log out** from your current session:
   - Go to your app
   - Click logout button
   - Or go to: `http://localhost:3000/fhir-access` and logout

2. **Clear your browser cookies** for localhost (optional but recommended)

3. **Log in again** with Epic credentials (e.g., fhircamila, fhirjason)

4. **Accept the scopes** when Epic shows you the authorization screen
   - You should now see MORE scopes listed in the authorization dialog
   - Epic will show you all the data types your app wants to access

5. Check if data now loads correctly

## 🧪 Testing After Fix

### Run This Test:
```bash
# In the Python terminal
cd mediconnect-1
python -m uvicorn app.main:app --reload --host localhost --port 8000 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
```

### Then:
1. Go to: `http://localhost:3000/fhir-access`
2. Click "Patient Portal Login"
3. Log in with Epic test credentials (e.g., `fhircamila` / `epicepic1`)
4. Complete the authorization
5. Click "Load Patient Data"
6. Check the logs - you should now see:
   ```
   ✅ Successfully fetched patient demographics
   ✅ Successfully fetched conditions
   ✅ Successfully fetched allergies
   ✅ Successfully fetched medications
   ✅ Successfully fetched vital signs
   ✅ Successfully fetched laboratory observations
   ✅ Successfully fetched procedures
   ✅ Successfully fetched immunizations
   ```

## 📊 Understanding Epic's Observation Data

Once scopes are fixed, **Observation.read** will retrieve:

### Social History (Smoking Status):
```json
{
  "resourceType": "Observation",
  "category": [{
    "coding": [{
      "system": "http://terminology.hl7.org/CodeSystem/observation-category",
      "code": "social-history"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "72166-2",
      "display": "Tobacco smoking status"
    }]
  },
  "valueCodeableConcept": {
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "428041000124106",
      "display": "Occasional tobacco smoker"
    }]
  }
}
```

### Vital Signs:
- Blood pressure
- Heart rate
- Temperature
- Respiratory rate
- Oxygen saturation
- Weight
- Height
- BMI

### Laboratory Results:
- Blood tests
- Glucose levels
- Cholesterol
- Etc.

## ❓ If You Still See 403 Errors

### Check Your Epic Account Permissions
1. **Test Patient Accounts**: Make sure you're logging in with a **test patient account** (like `fhircamila`, `fhirjason`, etc.)
2. **Not Practitioner**: Don't use practitioner/provider accounts for patient data access
3. **Sandbox Limitations**: Some Epic sandbox patients may have limited data

### Verify Granted Scopes
After logging in, check what scopes were actually granted:
1. Go to: `http://localhost:3000/fhir-access`
2. Look at the "Authentication Details" section
3. Check the "FHIR Data by Scope" section
4. It should list all the scopes you requested

### Check the Backend Logs
Look for lines like:
```
INFO: Authorized scopes: patient/Patient.read patient/Observation.read patient/Condition.read ...
```

If you see fewer scopes than requested, Epic didn't grant them all.

## 🆘 Emergency Workaround

If Epic's app configuration interface is confusing or not working:

### Option 1: Create a New Epic App
1. Go to: https://fhir.epic.com/Developer/Apps
2. Click "Create New App"
3. Choose **"Patient-Facing App"** or **"Public Client (PKCE)"**
4. Carefully select ALL the required scopes from the start
5. Set redirect URI: `https://localhost:8000/callback`
6. Save and note the new CLIENT_ID
7. Update your `.env` file with the new CLIENT_ID

### Option 2: Request Fewer Scopes (Temporary)
If you just want to test with the scopes that ARE working:

Edit `.env`:
```bash
# Minimal scopes that are currently working
FHIR_SCOPES=patient/Patient.read patient/AllergyIntolerance.read openid fhirUser
```

**But this won't give you observations/smoking history!**

## ✅ Success Checklist

After fixing, you should see:
- [ ] All scopes listed as "Selected" in Epic app config
- [ ] No more 403 errors in backend logs
- [ ] Observation data appearing in the UI
- [ ] Multiple observation categories working (vital-signs, social-history, laboratory)
- [ ] Smoking history data showing for test patients like Elijah

## 📞 Need Help?

If you're stuck:
1. Take a screenshot of your Epic app configuration (scopes section)
2. Share the backend logs showing the 403 errors
3. Verify you're using the correct Epic test patient accounts

---

**REMEMBER**: The problem is **NOT in your code**. Your code is requesting the scopes correctly. The problem is in the **Epic FHIR app registration** - the scopes are not properly selected in your app's configuration.
