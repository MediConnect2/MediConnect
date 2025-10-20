# 🧪 FHIR Scope Test Script

## Quick Start

### 1. Make sure the backend is running:
```bash
cd mediconnect-1
python start_https.py
```

### 2. Make sure you're logged in:
Go to http://localhost:3000/fhir-access and log in with Epic credentials

### 3. Run the test:
```bash
cd mediconnect-1
python3 test_scopes.py
```

## What This Script Does

✅ **Checks Authentication**: Verifies you're logged in with a valid token

✅ **Analyzes Scopes**: Shows which scopes were GRANTED vs DENIED by Epic

✅ **Tests FHIR Endpoints**: Actually calls each FHIR API endpoint to see what works:
- Patient Demographics (patient/Patient.read)
- Allergies (patient/AllergyIntolerance.read)
- Conditions (patient/Condition.read)
- Medications (patient/MedicationRequest.read)
- Vital Signs / Observations (patient/Observation.read) ← **This is the problematic one!**
- Procedures (patient/Procedure.read)

✅ **Provides Fix Instructions**: If scopes are missing, tells you exactly how to fix it

## Sample Output

```
🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍
  MediConnect FHIR Scope Test Script
🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍🔍

================================================================================
  Step 1: Checking Authentication Status
================================================================================
✅ Authenticated!
ℹ️  Patient ID: egqBHVfQlt4Bw3XGXoxVxHg3
ℹ️  Token Type: Bearer
ℹ️  Granted Scopes:
    • patient/Patient.read
    • patient/AllergyIntolerance.read
    • openid
    • fhirUser

================================================================================
  Step 2: Checking Scope Configuration
================================================================================
ℹ️  Scope Analysis:

  Requested: 8 scopes
  Granted:   4 scopes
  Denied:    4 scopes

  ✅ Granted Scopes:
    • patient/Patient.read
    • patient/AllergyIntolerance.read
    • openid
    • fhirUser

  ❌ Denied Scopes (NOT configured in Epic app):
    • patient/Observation.read
    • patient/Condition.read
    • patient/MedicationRequest.read
    • patient/Procedure.read

⚠️  4 scope(s) need to be added in Epic app!
ℹ️  Fix at: https://fhir.epic.com/Developer/Apps

================================================================================
  Step 3: Testing FHIR Resource Access
================================================================================

  Testing: Patient Demographics
  Endpoint: /api/patient/egqBHVfQlt4Bw3XGXoxVxHg3
  Required Scope: patient/Patient.read
✅ SUCCESS - Got data!

  Testing: Allergies
  Endpoint: /api/allergies
  Required Scope: patient/AllergyIntolerance.read
✅ SUCCESS - Got data!
    → Sample: LATEX

  Testing: Conditions
  Endpoint: /api/conditions
  Required Scope: patient/Condition.read
❌ DENIED (403 Forbidden)
⚠️  → Scope 'patient/Condition.read' not granted by Epic

  Testing: Medications
  Endpoint: /api/medications
  Required Scope: patient/MedicationRequest.read
❌ DENIED (403 Forbidden)
⚠️  → Scope 'patient/MedicationRequest.read' not granted by Epic

  Testing: Vital Signs
  Endpoint: /api/vital-signs
  Required Scope: patient/Observation.read
❌ DENIED (403 Forbidden)
⚠️  → Scope 'patient/Observation.read' not granted by Epic

  Testing: Procedures
  Endpoint: /api/procedures
  Required Scope: patient/Procedure.read
❌ DENIED (403 Forbidden)
⚠️  → Scope 'patient/Procedure.read' not granted by Epic

================================================================================
  Test Summary
================================================================================

📊 Scope Status:
  ✅ Granted: 4 scopes
  ❌ Denied:  4 scopes

⚠️  Missing Scopes (Need to add in Epic app):
    • patient/Observation.read
    • patient/Condition.read
    • patient/MedicationRequest.read
    • patient/Procedure.read

🧪 FHIR Endpoint Tests:
  ✅ PASS: Patient Demographics
  ✅ PASS: Allergies
  ❌ FAIL: Conditions
  ❌ FAIL: Medications
  ❌ FAIL: Vital Signs
  ❌ FAIL: Procedures

  Total: 2 passed, 4 failed out of 6 tests

================================================================================
  🔧 How to Fix
================================================================================

1. Go to: https://fhir.epic.com/Developer/Apps
2. Find your app with Client ID: 1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
3. Click "Edit Application"
4. Find the "FHIR Scopes" section
5. Move missing scopes from "Available" to "Selected" column
6. Click "Save"
7. Log out and log back in to get a fresh OAuth token

For detailed instructions, see:
  • SOLUTION_SUMMARY.md
  • SCOPE_FIX_INSTRUCTIONS.md

================================================================================
  Test Complete!
================================================================================
```

## Why This Is Better Than Manual Testing

❌ **Manual Testing**: 
- Open browser
- Click through UI
- Check each section
- Hard to see exactly what's failing

✅ **Automated Test Script**:
- Runs in seconds
- Tests ALL endpoints systematically
- Shows EXACT HTTP status codes (200, 403, etc.)
- Clear output showing what works and what doesn't
- Pinpoints missing scopes
- Provides fix instructions

## Common Issues

### "Not authenticated"
**Solution**: Log in first at http://localhost:3000/fhir-access, then run the script

### "Connection refused"
**Solution**: Make sure the backend is running:
```bash
cd mediconnect-1
python start_https.py
```

### All tests fail with 403
**Solution**: Your Epic app is missing scopes. Follow the fix instructions output by the script.

## After Fixing Epic App

1. Fix scopes in Epic app configuration
2. Log out from http://localhost:3000/fhir-access
3. Log back in (get fresh token with new scopes)
4. Run the test script again:
   ```bash
   python3 test_scopes.py
   ```
5. All tests should now PASS! 🎉

---

**This script proves the issue is NOT in your code, but in the Epic app configuration!**
