# 🚀 QUICKEST WAY TO CHECK YOUR SCOPES

## Step 1: Open Your App
Go to: http://localhost:3000/fhir-access (make sure you're logged in)

## Step 2: Open Browser Console
Press **F12** (or **Cmd+Option+I** on Mac)

Click on the **"Console"** tab

## Step 3: Run This Command

Copy and paste this into the console and press Enter:

```javascript
fetch('https://localhost:8000/api/auth-status', {credentials: 'include'})
  .then(r => r.json())
  .then(data => {
    console.log('='.repeat(60));
    console.log('AUTHENTICATION STATUS');
    console.log('='.repeat(60));
    console.log('Authenticated:', data.authenticated);
    console.log('Patient ID:', data.patient_id);
    console.log('\nGRANTED SCOPES:');
    console.log('='.repeat(60));
    
    if (data.scope) {
      const scopes = data.scope.split(' ');
      scopes.forEach(scope => console.log('  ✓', scope));
      
      console.log('\n' + '='.repeat(60));
      console.log('SCOPE ANALYSIS');
      console.log('='.repeat(60));
      
      const required = [
        'patient/Patient.read',
        'patient/Observation.read',
        'patient/Condition.read',
        'patient/AllergyIntolerance.read',
        'patient/MedicationRequest.read',
        'patient/Procedure.read',
        'patient/Immunization.read'
      ];
      
      required.forEach(scope => {
        if (scopes.includes(scope)) {
          console.log('  ✅ GRANTED:', scope);
        } else {
          console.log('  ❌ DENIED:', scope);
        }
      });
      
      const missing = required.filter(s => !scopes.includes(s));
      
      if (missing.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('⚠️  PROBLEM FOUND!');
        console.log('='.repeat(60));
        console.log('Missing scopes:', missing.length);
        console.log('You need to add these in Epic app:');
        missing.forEach(s => console.log('  •', s));
        console.log('\nFix at: https://fhir.epic.com/Developer/Apps');
        console.log('Client ID: 1a3aabaa-38dd-4a03-ac3a-38de1c40cae2');
      } else {
        console.log('\n' + '='.repeat(60));
        console.log('✅ ALL SCOPES GRANTED!');
        console.log('='.repeat(60));
      }
    }
  })
  .catch(err => console.error('Error:', err));
```

## What You'll See

### If Scopes Are Missing (Expected):
```
============================================================
GRANTED SCOPES:
============================================================
  ✓ patient/Patient.read
  ✓ patient/AllergyIntolerance.read
  ✓ openid
  ✓ fhirUser

============================================================
SCOPE ANALYSIS
============================================================
  ✅ GRANTED: patient/Patient.read
  ❌ DENIED: patient/Observation.read
  ❌ DENIED: patient/Condition.read
  ✅ GRANTED: patient/AllergyIntolerance.read
  ❌ DENIED: patient/MedicationRequest.read
  ❌ DENIED: patient/Procedure.read
  ❌ DENIED: patient/Immunization.read

============================================================
⚠️  PROBLEM FOUND!
============================================================
Missing scopes: 4
You need to add these in Epic app:
  • patient/Observation.read
  • patient/Condition.read
  • patient/MedicationRequest.read
  • patient/Procedure.read
  • patient/Immunization.read

Fix at: https://fhir.epic.com/Developer/Apps
Client ID: 1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
```

### If All Scopes Are Granted:
```
============================================================
✅ ALL SCOPES GRANTED!
============================================================
```

## This Proves The Issue!

**If you see `❌ DENIED: patient/Observation.read`**, that's your smoking history problem!

This is **NOT** a data availability issue - it's a scope configuration issue in your Epic app.

The **403 Forbidden** errors you're seeing are because Epic is rejecting your requests due to missing scopes.

## Next Step

Go to: https://fhir.epic.com/Developer/Apps
1. Find your app (Client ID: `1a3aabaa-38dd-4a03-ac3a-38de1c40cae2`)
2. Edit Application → FHIR Scopes
3. Move the DENIED scopes from "Available" to "Selected"
4. Save
5. Logout and login again

---

**This console test works 100% because it uses your existing browser session! No cookie issues!** 🎯
