# Epic FHIR Scope Category Fix

## Problem Identified

Your application was getting 403 errors for most FHIR resources (Conditions, Medications, Observations, Procedures, Immunizations) even though the scopes appeared to be granted in the Epic portal.

### Root Cause

Epic granted **category-specific scopes** with query parameter restrictions:

```
patient/Condition.r?category=http://terminology.hl7.org/CodeSystem/condition-category|problem-list-item
patient/Observation.r?category=http://terminology.hl7.org/CodeSystem/observation-category|vital-signs
patient/Observation.r?category=http://terminology.hl7.org/CodeSystem/observation-category|laboratory
patient/MedicationRequest.r
patient/Immunization.r
patient/Procedure.r
```

But your code was making **generic requests without the required category filters**:
- ❌ `/Condition?patient=xyz` → 403 Forbidden
- ❌ `/Observation?patient=xyz&category=vital-signs` → 403 Forbidden
- ❌ `/MedicationRequest?patient=xyz&status=active` → 403 Forbidden

## Solution Applied

Updated `mediconnect-1/app/services/fhir_service.py` to include the required category parameters:

### 1. Conditions - Added `problem-list-item` category
```python
async def fetch_conditions(self, patient_id: str, access_token: str) -> Dict[str, Any]:
    params = {
        "patient": patient_id,
        "category": "problem-list-item"  # ← ADDED
    }
```

### 2. Observations - Fetch both vital-signs AND laboratory
```python
# Fetch vital signs separately
vital_signs_data = await self.fetch_observations(patient_id, access_token, "vital-signs")

# Fetch laboratory separately  
laboratory_data = await self.fetch_observations(patient_id, access_token, "laboratory")

# Combine results
observations_data["entry"].extend(vital_signs_data.get("entry", []))
observations_data["entry"].extend(laboratory_data.get("entry", []))
```

### 3. MedicationRequest & Others
For MedicationRequest, Procedure, and Immunization - these should work WITHOUT category filters based on the scopes Epic granted. If they still return 403, it means:

**The Epic sandbox patient may not have data in those categories**, OR
**Additional configuration is needed in Epic's app settings**

## Testing

1. **Restart your server** (if not using auto-reload):
   ```powershell
   cd mediconnect-1
   python start_https.py
   ```

2. **Clear your browser cookies** and re-authenticate

3. **Expected Results:**
   - ✅ Patient Demographics (already working)
   - ✅ AllergyIntolerance (already working)
   - ✅ **Conditions** (should now work with category filter)
   - ✅ **Vital Signs** (should now work)
   - ✅ **Laboratory Results** (should now work)
   - ❓ Medications (may work - depends on Epic sandbox data)
   - ❓ Procedures (may work - depends on Epic sandbox data)
   - ❓ Immunizations (may work - depends on Epic sandbox data)

## Epic Sandbox Test Patients

Epic's sandbox test patients have different amounts of data. Try these test patients:

- **Derrick Lin** (Patient ID: `eD.LxhDyX35TntF77l7etUA3`) - Your current patient
- **Camila Lopez** - Has extensive medication and procedure history
- **Emily Williams** - Has immunization records

Each test patient in Epic's sandbox is pre-populated with different clinical data sets.

## If Still Getting 403 Errors

1. **Check the actual granted scopes** in the debug logs:
   ```
   DEBUG:app.main:Access token received | context={"scope": "patient/..."}
   ```

2. **Verify Epic app configuration:**
   - Go to https://fhir.epic.com/Developer/Apps
   - Click on your app
   - Check "FHIR Specification Version" = R4
   - Check "App Audience" = Patient
   - Verify all scopes are checked

3. **Try requesting broader category-agnostic scopes:**
   In Epic app settings, some resources may require enabling "All data" access rather than category-specific access.

## Additional Notes

- Epic's scope format in the token response uses `.r` suffix (read-only)
- The category parameter in API calls uses just the code (e.g., `vital-signs`), not the full system URL
- Some scopes include the full category URL like `category=http://terminology.hl7.org/CodeSystem/observation-category|vital-signs` but the API parameter should just be `category=vital-signs`
