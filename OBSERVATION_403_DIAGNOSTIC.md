# 🔍 Observation 403 Error - Diagnostic & Fix Guide

## Problem Summary
You're getting **403 Forbidden** errors when trying to fetch Observations (smoking history, vital signs, lab results) from Epic FHIR API, even though you can successfully retrieve Patient demographics and Allergies.

## Root Cause
**Your Epic app is NOT configured with the required scopes.** The scopes need to be manually selected in Epic's app configuration interface.

## Evidence from Your Logs
```
✅ patient/Patient.read - WORKS
✅ patient/AllergyIntolerance.read - WORKS
❌ patient/Observation.read - 403 FORBIDDEN
❌ patient/Condition.read - 403 FORBIDDEN  
❌ patient/MedicationRequest.read - 403 FORBIDDEN
❌ patient/Procedure.read - 403 FORBIDDEN
❌ patient/Immunization.read - 403 FORBIDDEN
```

## Why This Happens
When you created your Epic FHIR app, you likely:
1. ❌ Did not select all scopes in the Epic app configuration
2. ❌ Left scopes in "Available" column instead of moving to "Selected"
3. ❌ The app was saved without all required scopes enabled

## 🛠️ SOLUTION (Step-by-Step)

### Step 1: Access Epic App Configuration
1. Go to: **https://fhir.epic.com/Developer/Apps**
2. Sign in with your Epic developer credentials
3. Find your app: **Client ID: `1a3aabaa-38dd-4a03-ac3a-38de1c40cae2`**
4. Click **"Edit Application"** button

### Step 2: Find the Scopes Section
Look for a section called:
- "FHIR Scopes" OR
- "OAuth 2.0 Scopes" OR  
- "API Access" OR
- "Scopes Configuration"

You should see **two columns**:
- **Left**: "Available Scopes" (scopes you CAN add)
- **Right**: "Selected Scopes" (scopes your app WILL get)

### Step 3: Move These Scopes to "Selected"

**CRITICAL**: Each scope must be in the "Selected" column!

#### Required Scopes:
```
✅ openid
✅ fhirUser
✅ patient/Patient.read
✅ patient/Observation.read          ⚠️ THIS IS MISSING - CAUSES 403!
✅ patient/Condition.read             ⚠️ THIS IS MISSING - CAUSES 403!
✅ patient/AllergyIntolerance.read
✅ patient/MedicationRequest.read     ⚠️ THIS IS MISSING - CAUSES 403!
✅ patient/Procedure.read             ⚠️ THIS IS MISSING - CAUSES 403!
✅ patient/Immunization.read          ⚠️ THIS IS MISSING - CAUSES 403!
```

#### How to Move Scopes:
1. Find each scope in the "Available" column
2. Click on it
3. Click the **arrow button (→)** or **"Add"** button
4. Verify it appears in the "Selected" column

### Step 4: Why Observation.read is Critical
The `patient/Observation.read` scope provides access to:
- 🚬 **Smoking history** (social-history category)
- ❤️ Vital signs (blood pressure, heart rate, temperature)
- 🔬 Laboratory results (blood tests, glucose, etc.)
- 📊 Other clinical observations

**Without this scope, you'll get 403 errors for ALL observation data!**

### Step 5: Save Your Changes
1. Scroll to the bottom of the Epic app configuration page
2. Click **"Save"** or **"Save & Build"**
3. Wait for confirmation message
4. Note: Changes may take a few seconds to propagate

### Step 6: Re-authenticate Your Session
After updating Epic app scopes, you MUST re-authenticate:

1. **Logout** from your current session
   - Go to `http://localhost:3000/fhir-access`
   - Click the logout button

2. **Clear browser cookies** (optional but recommended)

3. **Login again** with Epic test credentials
   - Example: `fhircamila` / `epicepic1`
   - Or: `fhirjason` / `epicepic1`

4. **Accept scopes** when Epic shows the authorization screen
   - You should now see MORE scopes in the list
   - Epic will ask permission to share more data types

5. **Verify in logs**
   - Backend should now show: `✅ Successfully fetched observations`

## 🧪 Testing the Fix

### Method 1: Check the Diagnostic Endpoint
After re-authenticating, visit this endpoint to see what scopes were granted:

```bash
curl -X GET https://localhost:8000/api/scope-diagnostic \
  --cookie "your-session-cookie" \
  -k
```

Or in your browser (while logged in):
```
https://localhost:8000/api/scope-diagnostic
```

This will show you:
- ✅ Which scopes were granted
- ❌ Which scopes were denied
- 🔗 Direct link to fix Epic app configuration

### Method 2: Check Backend Logs
Start your backend:
```bash
cd mediconnect-1
python -m uvicorn app.main:app --reload --host localhost --port 8000 \
  --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
```

After login, look for these log lines:
```
🔑 REQUESTED SCOPES: patient/Patient.read patient/Observation.read ...
✅ GRANTED SCOPES: patient/Patient.read patient/Observation.read ...
```

If you see:
```
⚠️ DENIED SCOPES (not granted by Epic): patient/Observation.read ...
```

Then Epic is **still not granting** those scopes. Double-check Epic app config!

### Method 3: Test with Patient Data
1. Go to `http://localhost:3000/fhir-access`
2. Login with Epic test patient (e.g., `fhircamila`)
3. Click "Load Patient Data"
4. Check the "Observation.Read (Vital Signs) (R4)" section
5. Should show data instead of "No patient data returned"

## 📊 Understanding Observation Categories

Once `patient/Observation.read` is granted, you can fetch different observation types:

### Social History (Smoking Status)
```http
GET /Observation?patient={id}&category=http://terminology.hl7.org/CodeSystem/observation-category|social-history
```

Example response:
```json
{
  "resourceType": "Observation",
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "72166-2",
      "display": "Tobacco smoking status"
    }]
  },
  "valueCodeableConcept": {
    "coding": [{
      "display": "Occasional tobacco smoker"
    }]
  }
}
```

### Vital Signs
```http
GET /Observation?patient={id}&category=http://terminology.hl7.org/CodeSystem/observation-category|vital-signs
```

Returns: Blood pressure, heart rate, temperature, etc.

### Laboratory Results
```http
GET /Observation?patient={id}&category=http://terminology.hl7.org/CodeSystem/observation-category|laboratory
```

Returns: Blood tests, glucose, cholesterol, etc.

## 🔴 Still Getting 403 Errors?

### Common Issues:

#### Issue 1: Scopes Still in "Available" Column
- **Problem**: You thought you selected them, but they're still in "Available"
- **Fix**: Look carefully at both columns, ensure scopes are in "Selected"

#### Issue 2: Epic App Not Saved
- **Problem**: You edited but didn't click "Save"
- **Fix**: Scroll to bottom, click "Save & Build"

#### Issue 3: Old Session Still Active
- **Problem**: Using old access token without new scopes
- **Fix**: Logout completely, clear cookies, login again

#### Issue 4: Using Wrong Account Type
- **Problem**: Logged in as practitioner instead of patient
- **Fix**: Use patient test accounts (fhircamila, fhirjason, etc.)

#### Issue 5: Epic Sandbox Limitations
- **Problem**: Some test patients have limited data
- **Fix**: Try different test patients (Elijah, Camila, Jason, etc.)

## 🆘 Advanced Debugging

### Check What Scopes Epic Actually Granted
After login, check the token:
```javascript
// In browser console on your app
fetch('https://localhost:8000/api/auth-status', {
  credentials: 'include'
})
.then(r => r.json())
.then(data => console.log('Granted scopes:', data.scope))
```

### Check Epic's Authorization Server Response
Look at your backend logs for:
```
INFO: Authorized scopes: patient/Patient.read patient/AllergyIntolerance.read
```

If `patient/Observation.read` is NOT in that list, Epic didn't grant it!

### Manual FHIR API Test
Test if you can access observations directly:
```bash
curl -X GET "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Observation?patient=YOUR_PATIENT_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Accept: application/fhir+json"
```

If you get 403, the scope wasn't granted.

## ✅ Success Checklist

After fixing, you should see:

- [ ] All 9 required scopes in "Selected" column in Epic app
- [ ] Epic saved successfully with green confirmation
- [ ] Logged out and logged back in to get new token
- [ ] Backend logs show: `✅ GRANTED SCOPES: patient/Patient.read patient/Observation.read ...`
- [ ] No `⚠️ DENIED SCOPES` warnings in logs
- [ ] Backend logs show: `✅ Successfully fetched vital signs`
- [ ] Backend logs show: `✅ Successfully fetched social history (smoking status, etc.)`
- [ ] Frontend shows observation data instead of "None"
- [ ] Can see smoking history for test patients like Elijah

## 📞 Need More Help?

### Documents to Review:
1. `SCOPE_FIX_INSTRUCTIONS.md` - Detailed Epic app configuration guide
2. `EPIC_APP_SETUP.md` - Complete Epic app setup checklist
3. Your Epic app at: https://fhir.epic.com/Developer/Apps

### Epic Test Patient Accounts:
- Username: `fhircamila` / Password: `epicepic1`
- Username: `fhirjason` / Password: `epicepic1`
- Username: `fhirelijah` / Password: `epicepic1` (if available)

### What to Check:
1. Screenshot your Epic app's "Scopes" configuration
2. Share backend logs showing the REQUESTED vs GRANTED scopes
3. Verify you're using patient test accounts (not practitioner)

---

**Remember**: The problem is **NOT in your code**. Your application is correctly requesting the scopes and handling the API calls. The issue is that **Epic's app configuration** doesn't have the scopes selected, so Epic refuses to grant them during OAuth authorization.
