# CSRF State Mismatch Error - Troubleshooting Guide

## Error Message
```json
{"error":"Authentication failed","details":"mismatching_state: CSRF Warning! State not equal in request and response."}
```

## ✅ SOLUTION APPLIED

Your backend is now running with HTTPS on `https://0.0.0.0:8000`

---

## What Caused This Error?

The OAuth flow uses a "state" parameter for CSRF protection:

1. **Step 1:** Your app generates a random `state` value
2. **Step 2:** Stores it in the session
3. **Step 3:** Redirects to Epic with `state` in URL
4. **Step 4:** Epic redirects back with the same `state`
5. **Step 5:** Your app compares session state vs. URL state
6. **❌ Error:** States don't match = session was lost

### Why Sessions Get Lost

| Issue | Cause | Solution |
|-------|-------|----------|
| **HTTP vs HTTPS mismatch** | `/login` on HTTP, `/callback` on HTTPS | ✅ Run backend with HTTPS |
| **Domain mismatch** | `127.0.0.1` vs `localhost` | Use consistent domain |
| **SameSite cookie policy** | Browser blocks cross-site cookies | Set `SameSite=None; Secure` |
| **Missing session middleware** | Sessions not configured | Add SessionMiddleware |
| **Cookie not sent** | Browser privacy settings | Check browser settings |

---

## Your Specific Issue

**Problem:** Your redirect URI uses HTTPS:
```
REDIRECT_URI=https://localhost:8000/callback
```

**But you were running the backend on HTTP:**
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# This runs on http://127.0.0.1:8000
```

**Result:** 
- `/login` sets session cookie on HTTP
- Epic redirects to HTTPS `/callback`
- Browser doesn't send HTTP cookie to HTTPS site
- Session state is lost
- ❌ CSRF error

---

## ✅ Solution: Run Backend with HTTPS

**Always run with HTTPS when using `https://` redirect URI:**

```powershell
cd mediconnect-1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
```

**Or use the helper script:**
```powershell
cd mediconnect-1
python start_https.py
```

---

## Testing the Fix

### 1. **Verify Backend is Running with HTTPS**

Check the terminal output:
```
INFO: Uvicorn running on https://0.0.0.0:8000
```

✅ Should say **`https://`** not `http://`

### 2. **Clear Browser Cookies**

Important! Old cookies might interfere:

**Chrome/Edge:**
1. Press `F12` (Developer Tools)
2. Go to "Application" tab
3. Click "Cookies" → "https://localhost:8000"
4. Right-click → "Clear"

**Firefox:**
1. Press `F12`
2. Go to "Storage" tab
3. Click "Cookies" → "https://localhost:8000"
4. Right-click → "Delete All"

### 3. **Test the OAuth Flow**

1. Go to: `http://localhost:3000/fhir-access`
2. Click "Login with EHR System"
3. Should redirect to Epic login
4. Enter test credentials:
   - Username: `fhircamila`
   - Password: `epicepic1`
5. Click "Allow" on authorization screen
6. You'll see SSL warning (self-signed cert)
7. Click "Advanced" → "Proceed to localhost"
8. ✅ Should successfully redirect to frontend!

---

## Additional Fixes (If Still Not Working)

### Fix 1: Use Consistent Domain

Make sure you're using `localhost` everywhere (not mixing `localhost` and `127.0.0.1`):

**In Epic app registration:**
```
https://localhost:8000/callback
```

**In `.env`:**
```properties
REDIRECT_URI=https://localhost:8000/callback
```

**In browser:**
```
http://localhost:3000/fhir-access
```

### Fix 2: Check CORS Credentials

Your CORS is already configured correctly, but verify:

```python
# In app/main.py (already correct)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,  # ✅ This must be True
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Fix 3: Verify Session Secret Key

Check `.env` has a valid session secret:

```properties
SESSION_SECRET_KEY=drkcXZX2R5Xq8dkkqvvx4LvDqe8XoRkaSTnDZxmRjew
```

If it's empty or default, generate a new one:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Fix 4: Check Browser Console

Press `F12` in your browser and check for errors:

**Common issues:**
- Cookie blocked by browser
- CORS error
- Mixed content warning
- Network error

### Fix 5: Restart Everything

Sometimes sessions get stuck:

1. **Stop backend** (Ctrl+C)
2. **Stop frontend** (Ctrl+C)
3. **Clear browser cookies**
4. **Restart backend with HTTPS:**
   ```powershell
   cd mediconnect-1
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
   ```
5. **Restart frontend:**
   ```powershell
   cd mediconnect
   npm run dev
   ```
6. **Try OAuth flow again**

---

## Understanding the OAuth State Flow

### Normal Flow (What Should Happen):

```
1. User clicks "Login with EHR System"
   ↓
2. Backend /login endpoint:
   - Generates random state: "abc123xyz"
   - Stores in session: session['state'] = "abc123xyz"
   - Sets session cookie in browser
   - Redirects to Epic with state=abc123xyz
   ↓
3. User logs into Epic
   ↓
4. Epic redirects to /callback?code=...&state=abc123xyz
   ↓
5. Backend /callback endpoint:
   - Reads session: session['state'] = "abc123xyz"
   - Reads URL: state = "abc123xyz"
   - Compares: "abc123xyz" == "abc123xyz" ✅
   - Exchanges code for token
   - Success!
```

### What Was Happening (Before Fix):

```
1. User clicks "Login with EHR System"
   ↓
2. Backend /login endpoint (HTTP):
   - Generates state: "abc123xyz"
   - Stores in session
   - Sets cookie on http://127.0.0.1:8000
   - Redirects to Epic with state=abc123xyz
   ↓
3. User logs into Epic
   ↓
4. Epic redirects to https://localhost:8000/callback
   ↓
5. Backend /callback endpoint (HTTPS):
   - Reads session: session['state'] = None ❌ (no cookie sent)
   - Reads URL: state = "abc123xyz"
   - Compares: None != "abc123xyz" ❌
   - Error: "mismatching_state"
```

---

## Quick Checklist

Before testing OAuth flow, verify:

- ✅ Backend running with HTTPS (see `https://` in terminal)
- ✅ Redirect URI in Epic: `https://localhost:8000/callback`
- ✅ Redirect URI in `.env`: `https://localhost:8000/callback`
- ✅ Frontend accessing: `http://localhost:3000` (can be HTTP)
- ✅ Browser cookies cleared
- ✅ Using `localhost` (not `127.0.0.1`) consistently
- ✅ `SESSION_SECRET_KEY` is set in `.env`
- ✅ No other app using port 8000

---

## Success Indicators

You'll know it's working when:

1. ✅ No CSRF/state mismatch error
2. ✅ After Epic login, you see SSL warning (expected)
3. ✅ After accepting SSL warning, redirects to frontend
4. ✅ Frontend shows "Authenticated" status
5. ✅ Can fetch patient data successfully

---

## Still Having Issues?

### Check Backend Logs

Look for these in the terminal:

```
INFO: Redirecting to EHR authorization endpoint: https://fhir.epic.com/...
INFO: 127.0.0.1:xxxxx - "GET /login HTTP/1.1" 302 Found
INFO: 127.0.0.1:xxxxx - "GET /callback?code=... HTTP/1.1" 302 Found
```

If you see errors, they'll help diagnose the issue.

### Enable Debug Logging

Add this to `app/main.py` temporarily:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

This will show detailed session and cookie information.

---

## Summary

**Root Cause:** HTTP backend with HTTPS redirect URI caused session cookies to be lost.

**Solution:** Run backend with HTTPS to match the redirect URI.

**Command:**
```powershell
cd mediconnect-1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
```

**Your backend is now running correctly on HTTPS!** 🎉

Try the OAuth flow again and it should work!
