# OAuth Callback Session ID Fix

## Problem
After Epic redirected back to `/callback`, the endpoint was returning a 422 error:
```json
{"detail":[{"type":"missing","loc":["query","session_id"],"msg":"Field required","input":null}]}
```

## Root Cause
**OAuth flow mismatch**: Epic's OAuth callback only returns `code` and `state` parameters - it does NOT return a custom `session_id` parameter.

Our original implementation incorrectly expected three parameters:
```python
@app.get("/callback")
async def fhir_callback(
    code: str = Query(...),
    state: str = Query(...),
    session_id: str = Query(...)  # ❌ Epic doesn't send this!
):
```

## How OAuth State Works

In OAuth2, the `state` parameter serves two purposes:
1. **CSRF Protection**: Validates the callback is from the authorization request
2. **Session Tracking**: Links the callback to the original authorization request

The correct pattern is to:
- Generate a random `state` value when initiating OAuth
- Store session data using `state` as the key
- Validate `state` when Epic calls back
- Retrieve session data using the returned `state`

## Solution

### 1. Store Session Data by STATE (not session_id)

**Before:**
```python
token_store[session_id] = {
    "code_verifier": code_verifier,
    "state": state,
    "timestamp": int(time.time())
}
```

**After:**
```python
# Use STATE as the primary key (Epic only returns state)
token_store[state] = {
    "code_verifier": code_verifier,
    "state": state,
    "session_id": session_id,  # Keep reference to original session
    "timestamp": int(time.time())
}

# Also store mapping for frontend lookups by session_id
token_store[f"session_{session_id}"] = {"state": state}
```

### 2. Update Callback Handler Signature

**Before:**
```python
async def handle_callback(self, code: str, state: str, session_id: str):
    session_data = token_store.get(session_id)  # ❌ Wrong key
```

**After:**
```python
async def handle_callback(self, code: str, state: str):
    session_data = token_store.get(state)  # ✅ Correct - use state as key
```

### 3. Update Callback Endpoint

**Before:**
```python
@app.get("/callback")
async def fhir_callback(
    code: str = Query(...),
    state: str = Query(...),
    session_id: str = Query(...)  # ❌ Epic doesn't send this
):
    token_data = await fhir_oauth.handle_callback(code, state, session_id)
```

**After:**
```python
@app.get("/callback")
async def fhir_callback(
    code: str = Query(...),
    state: str = Query(...)  # ✅ Only what Epic actually sends
):
    token_data = await fhir_oauth.handle_callback(code, state)
    # Return the original session_id from stored data
    return {
        "session_id": token_data.get("session_id", state),
        ...
    }
```

### 4. Update Frontend Callback Call

**Before:**
```typescript
const callbackRes = await fetch(
    `${API_BASE}/callback?code=${code}&state=${state}&session_id=${fhirSessionId}`,  // ❌
    { method: 'GET' }
);
```

**After:**
```typescript
const callbackRes = await fetch(
    `${API_BASE}/callback?code=${code}&state=${state}`,  // ✅ Only what Epic sends
    { method: 'GET' }
);

const callbackData = await callbackRes.json();
const actualSessionId = callbackData.session_id;  // Get session_id from response
```

### 5. Store Token Data in Multiple Locations

To support lookups by both `state` and `session_id`:

```python
token_data_obj = {
    "access_token": access_token,
    "patient_id": patient_id,
    "session_id": session_id,
    "state": state,
    ...
}

# Store by state (for immediate callback lookup)
token_store[state] = token_data_obj

# Store by session_id (for frontend API calls)
token_store[session_id] = token_data_obj
```

## Files Modified

1. **`server_end/fhir_oauth.py`**
   - Changed session storage to use `state` as primary key
   - Updated `handle_callback()` to only require `code` and `state`
   - Store token data by both `state` and `session_id`

2. **`server_end/main.py`**
   - Removed `session_id` parameter from `/callback` endpoint
   - Updated to only expect `code` and `state` from Epic

3. **`mediconnect/src/app/callback/page.tsx`**
   - Removed `session_id` from callback URL query params
   - Use `session_id` returned in callback response

## OAuth Flow (After Fix)

1. **Initiate Login** (`POST /fhir-login`):
   - Generate `session_id` = `"fhir_username_randomstring"`
   - Generate `state` = random token
   - Store: `token_store[state] = {session_id, code_verifier, ...}`
   - Redirect to Epic with `state` in URL

2. **Epic Redirects Back**:
   - URL: `https://localhost:8000/callback?code=XXX&state=YYY`
   - Note: Only `code` and `state` - NO `session_id`

3. **Handle Callback** (`GET /callback`):
   - Look up session: `session_data = token_store[state]`
   - Extract original `session_id` from session_data
   - Exchange code for token
   - Store token by both `state` AND `session_id`
   - Return `session_id` to frontend

4. **Frontend Links FHIR Data**:
   - Uses returned `session_id` to call `/patient/link-fhir`
   - Backend looks up token: `token_store[session_id]`

## Why This Works

- **Epic compliance**: We only expect parameters Epic actually sends
- **Bidirectional lookup**: Token data accessible by both `state` (from Epic) and `session_id` (from frontend)
- **Session continuity**: Original `session_id` preserved throughout the flow
- **CSRF protection**: State validation still works as intended

## Testing

After this fix, the OAuth callback should:
1. ✅ Accept Epic's redirect without 422 errors
2. ✅ Successfully exchange authorization code for access token
3. ✅ Return the original session_id to frontend
4. ✅ Allow frontend to link FHIR data to patient account
