# OAuth Callback Frontend Redirect Fix

## Problem
After Epic OAuth callback succeeded, the user saw raw JSON in the browser instead of the React UI:
```json
{"status":"success","message":"FHIR authentication successful",...}
```

The FHIR data was NOT being stored in MongoDB.

## Root Cause
**Wrong redirect flow**: Epic was redirecting to the **backend** (`https://localhost:8000/callback`), which was returning JSON instead of redirecting to the **frontend** React page.

The OAuth callback flow needs to:
1. Backend receives Epic's callback with `code` and `state`
2. Backend exchanges code for access token
3. **Backend redirects to FRONTEND callback page**
4. Frontend displays UI and calls `/patient/link-fhir` to store data in MongoDB

## Solution

### 1. Backend Redirects to Frontend

**Before:**
```python
@app.get("/callback")
async def fhir_callback(code: str, state: str):
    token_data = await fhir_oauth.handle_callback(code, state)
    
    # ❌ Returns JSON - user sees raw data in browser
    return {
        "status": "success",
        "session_id": token_data.get("session_id"),
        ...
    }
```

**After:**
```python
@app.get("/callback")
async def fhir_callback(code: str, state: str):
    token_data = await fhir_oauth.handle_callback(code, state)
    
    session_id = token_data.get("session_id", state)
    patient_id = token_data.get("patient_id")
    
    # ✅ Redirect to frontend with session info
    frontend_callback_url = f"http://localhost:3000/callback?session_id={session_id}&patient_id={patient_id}&status=success"
    
    return RedirectResponse(url=frontend_callback_url, status_code=302)
```

### 2. Frontend Handles Query Parameters

**Before:**
```typescript
// Expected code and state from Epic
const code = searchParams.get('code');
const state = searchParams.get('state');

// Called backend callback endpoint
const callbackRes = await fetch(`${API_BASE}/callback?code=${code}&state=${state}`);
```

**After:**
```typescript
// Get session_id from backend redirect
const sessionIdParam = searchParams.get('session_id');
const patientIdParam = searchParams.get('patient_id');

// Skip backend callback call - already handled!
// Go straight to linking FHIR data
const linkRes = await fetch(`${API_BASE}/patient/link-fhir`, {
    method: 'POST',
    body: JSON.stringify({
        mediconnect_username: mediconnectUsername,
        fhir_session_id: sessionIdParam
    })
});
```

## OAuth Flow (Complete)

### 1. Initiate FHIR Login
**User Action**: Click "Connect to Healthcare Provider"

**Frontend** (`/patient-register`):
```typescript
const res = await fetch(`${API_BASE}/fhir-login`, {
    method: 'POST',
    body: JSON.stringify({ patient_username: username })
});

const data = await res.json();
localStorage.setItem('fhir_session_id', data.session_id);
localStorage.setItem('mediconnect_username', username);

window.location.href = data.redirect_url;  // Redirect to Epic
```

**Backend** (`POST /fhir-login`):
```python
session_id = f"fhir_{username}_{random}"
state = random_token()

token_store[state] = {
    "session_id": session_id,
    "code_verifier": code_verifier,
    ...
}

redirect_url = f"https://fhir.epic.com/...?state={state}&..."
return {"session_id": session_id, "redirect_url": redirect_url}
```

### 2. Epic OAuth Flow
**User**: Logs into Epic MyChart, grants permissions

**Epic**: Redirects to `https://localhost:8000/callback?code=XXX&state=YYY`

### 3. Backend Handles OAuth Callback
**Backend** (`GET /callback`):
```python
# Look up session by state
session_data = token_store[state]
session_id = session_data["session_id"]

# Exchange code for token
token_data = await exchange_code_for_token(code, code_verifier)

# Store token data
token_store[session_id] = token_data

# Redirect to frontend
return RedirectResponse(
    url=f"http://localhost:3000/callback?session_id={session_id}&patient_id={patient_id}&status=success"
)
```

### 4. Frontend Displays UI and Stores Data
**Frontend** (`/callback`):
```typescript
// Get session_id from URL (backend added it during redirect)
const sessionIdParam = searchParams.get('session_id');
const username = localStorage.getItem('mediconnect_username');

// Call backend to fetch FHIR data and store in MongoDB
const linkRes = await fetch(`${API_BASE}/patient/link-fhir`, {
    method: 'POST',
    body: JSON.stringify({
        mediconnect_username: username,
        fhir_session_id: sessionIdParam
    })
});

// Display success message with React UI
setStatus('success');
setMessage(`Successfully connected! Imported X allergies, Y conditions...`);

// Redirect to dashboard after 3 seconds
setTimeout(() => router.push('/'), 3000);
```

### 5. Backend Stores FHIR Data
**Backend** (`POST /patient/link-fhir`):
```python
# Get token from session
token_data = token_store.get(fhir_session_id)
access_token = token_data["access_token"]
patient_id = token_data["patient_id"]

# Fetch comprehensive FHIR data from Epic
fhir_data = await fhir_service.fetch_comprehensive_patient_data(
    patient_id=patient_id,
    access_token=access_token
)

# Store in MongoDB
await patients_collection.update_one(
    {"mediconnect_username": username},
    {"$set": {
        "fhir_patient_id": patient_id,
        "fhir_data": fhir_data,
        "fhir_connected": True,
        "registration_status": "completed"
    }}
)

return {"status": "success", "data_summary": {...}}
```

## Files Modified

1. **`server_end/main.py`**
   - Added `import logging` and created `logger`
   - Changed `/callback` to redirect to frontend instead of returning JSON

2. **`mediconnect/src/app/callback/page.tsx`**
   - Updated to expect `session_id` and `patient_id` from URL query params
   - Removed redundant backend callback API call
   - Goes straight to `/patient/link-fhir` to store data

## Why This Works

✅ **Backend handles OAuth complexity**: Token exchange happens server-side (secure)  
✅ **Frontend handles UI/UX**: React page shows progress, success, errors  
✅ **Data gets stored**: `/patient/link-fhir` fetches FHIR data and saves to MongoDB  
✅ **Clean separation**: Backend = auth & data, Frontend = presentation  

## Testing

After this fix:
1. ✅ Click "Connect to Healthcare Provider"
2. ✅ Log into Epic MyChart
3. ✅ Grant access permissions
4. ✅ **Redirected to React callback page** (not raw JSON!)
5. ✅ See "Fetching your medical records..." message
6. ✅ See success message with data summary
7. ✅ **FHIR data stored in MongoDB cluster**
8. ✅ Redirected to dashboard after 3 seconds

## Verification

Check MongoDB to confirm data was stored:
```javascript
db.patients.findOne(
    {"mediconnect_username": "your_username"},
    {"fhir_data": 1, "fhir_connected": 1, "fhir_patient_id": 1}
)
```

Should show:
- `fhir_connected: true`
- `fhir_patient_id: "egqBHVfQlt4Bw3XGXoxVxHg3"`
- `fhir_data: { patient: {...}, allergies: {...}, ... }`
