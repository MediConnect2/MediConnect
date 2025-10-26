# Fixed HTTP to HTTPS API URLs

## Issue Fixed (October 25, 2025)

### Problem
EMT login and patient access pages were failing with network errors:
```
[Error] The network connection was lost.
[Error] Fetch API cannot load http://127.0.0.1:8000/check-patient-access due to access control checks.
```

### Root Cause
Multiple frontend files had hardcoded HTTP URLs (`http://127.0.0.1:8000`) trying to connect to the backend, but the backend server is running on HTTPS (`https://localhost:8000`).

## Files Fixed

### 1. `/mediconnect/src/app/patient-access/page.tsx`
**Changes:**
- Added `API_BASE` constant: `const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';`
- Fixed 3 hardcoded URLs:
  - `check-patient-access` endpoint
  - `patient/login` endpoint
  - `patient/delete` endpoint

**Before:**
```typescript
fetch('http://127.0.0.1:8000/check-patient-access', ...)
fetch('http://127.0.0.1:8000/patient/login', ...)
fetch('http://127.0.0.1:8000/patient/delete', ...)
```

**After:**
```typescript
fetch(`${API_BASE}/check-patient-access`, ...)
fetch(`${API_BASE}/patient/login`, ...)
fetch(`${API_BASE}/patient/delete`, ...)
```

### 2. `/mediconnect/src/app/patient-login/page.tsx`
**Changes:**
- Fixed 1 hardcoded URL for patient login

**Before:**
```typescript
fetch("http://127.0.0.1:8000/patient/login", ...)
```

**After:**
```typescript
fetch(`${API_BASE}/patient/login`, ...)
```

### 3. `/mediconnect/src/app/emt-register/page.tsx`
**Changes:**
- Added `API_BASE` constant
- Fixed EMT registration endpoint

**Before:**
```typescript
fetch('http://127.0.0.1:8000/emt/register', ...)
```

**After:**
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';
fetch(`${API_BASE}/emt/register`, ...)
```

### 4. `/mediconnect/src/app/page.tsx` (EMT Login)
**Changes:**
- Updated default API_BASE from HTTP to HTTPS
- Fixed duplicate import statement

**Before:**
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://127.0.0.1:8000';
```

**After:**
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';
```

## Why This Matters

### Security
- **HTTPS encryption** protects sensitive medical data in transit
- **Self-signed certificates** are acceptable for local development
- **Production** will use valid SSL certificates

### CORS & Mixed Content
- Browsers block HTTP requests from HTTPS pages (mixed content)
- CORS errors occur when protocol mismatch exists
- Consistent HTTPS usage prevents these issues

### Backend Configuration
The backend server is configured to run on HTTPS:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000 \
  --ssl-keyfile ./certs/key.pem \
  --ssl-certfile ./certs/cert.pem
```

## Environment Variable

All files now use the `NEXT_PUBLIC_API_BASE` environment variable with a fallback:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';
```

### To customize in production:
Create `.env.local` file:
```
NEXT_PUBLIC_API_BASE=https://your-production-domain.com
```

## Testing

1. ✅ EMT login at `/` should work
2. ✅ Patient access at `/patient-access` should work
3. ✅ Patient login at `/patient-login` should work
4. ✅ EMT registration at `/emt-register` should work
5. ✅ All API calls now use HTTPS

## Certificate Warnings

When testing locally, you may see:
- "Your connection is not private" warning
- "NET::ERR_CERT_AUTHORITY_INVALID" error

**This is expected** for self-signed certificates. Click "Advanced" → "Proceed to localhost (unsafe)" to continue.

## Summary

All hardcoded HTTP API URLs have been replaced with HTTPS URLs using the `API_BASE` constant. The frontend now properly communicates with the HTTPS backend server, fixing the network connection errors.

**Total fixes:** 5 hardcoded URLs across 4 files
