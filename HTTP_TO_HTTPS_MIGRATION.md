# API Endpoint Updates - HTTP to HTTPS Migration

## Problem
After migrating the backend to HTTPS, all frontend pages making API calls to `http://localhost:8000` were failing with 401 Unauthorized errors because:
1. The server is now running on `https://localhost:8000`
2. API calls were still using `http://localhost:8000`
3. Tokens and authentication requests were going to the wrong protocol

## Solution
Updated all frontend pages to use the `API_BASE` environment variable that points to `https://localhost:8000`.

## Files Updated

### ✅ Patient Registration Flow
- **`patient-register/page.tsx`** - UPDATED
  - `/verify-hospital-token`
  - `/register`
  - `/fhir-login`
  - `/patient/skip-fhir`

### ✅ FHIR Callback
- **`fhir-callback/page.tsx`** - UPDATED
  - `/fhir-callback`
  - `/patient/link-fhir`

### ✅ Hospital Login
- **`hospital-login/page.tsx`** - UPDATED ✨ JUST FIXED
  - `/verify-hospital-token`
  - `/hospital/login`

### ✅ Patient Login
- **`patient-login/page.tsx`** - UPDATED ✨ JUST FIXED
  - `/verify-emt-token` (3 occurrences)
  - `/verify-patient-token`

### ✅ FHIR Access
- **`fhir-access/page.tsx`** - ALREADY USING API_BASE
  - Already had `const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000'`

## Environment Configuration

### Backend (.env)
```env
REDIRECT_URI=https://localhost:8000/fhir-callback
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_BASE=https://localhost:8000
```

## How to Test

### 1. Hospital Login Flow
```bash
# Test hospital login
1. Go to http://localhost:3000/hospital-login
2. Login with hospital credentials
3. Should redirect to /patient-register without errors
4. Check browser console - no 401 errors
```

### 2. Patient Registration
```bash
1. Fill in patient registration form
2. Click "Next" - should save to MongoDB
3. Click "Connect Provider" - should redirect to Epic
4. No "Failed to fetch" errors
```

### 3. Check Browser Network Tab
```bash
# All API calls should show:
Request URL: https://localhost:8000/...
Status: 200 OK (or appropriate status)
```

## Common Issues & Fixes

### Issue: "Failed to fetch" or CORS errors
**Cause**: Frontend still using HTTP, backend on HTTPS
**Fix**: Restart Next.js server to pick up `.env.local` changes
```bash
pkill -f "next dev"
cd mediconnect && npm run dev
```

### Issue: 401 Unauthorized after login
**Cause**: Token was issued on HTTP, trying to use on HTTPS (or vice versa)
**Fix**: Clear localStorage and login again
```javascript
// In browser console:
localStorage.clear()
// Then login again
```

### Issue: Certificate warnings in browser
**Cause**: Self-signed SSL certificate
**Fix**: Click "Advanced" → "Proceed to localhost (unsafe)"
**Note**: This is expected for development. Production uses real certificates.

## Verification Checklist

- [ ] Backend running on HTTPS (https://localhost:8000)
- [ ] Frontend `.env.local` has `NEXT_PUBLIC_API_BASE=https://localhost:8000`
- [ ] Next.js server restarted after `.env.local` change
- [ ] Hospital login works without 401 errors
- [ ] Patient registration Step 1 saves successfully
- [ ] FHIR connection (Step 2) redirects to Epic
- [ ] Browser Network tab shows all requests to `https://localhost:8000`

## Updated Pages Summary

| Page | Status | API Calls Updated |
|------|--------|------------------|
| `patient-register/page.tsx` | ✅ Updated | 4 endpoints |
| `fhir-callback/page.tsx` | ✅ Updated | 2 endpoints |
| `hospital-login/page.tsx` | ✅ **FIXED** | 2 endpoints |
| `patient-login/page.tsx` | ✅ **FIXED** | 4 endpoints |
| `fhir-access/page.tsx` | ✅ Already OK | Uses API_BASE |

## Next Steps

1. **Clear your browser cache and localStorage**
   ```javascript
   // Browser console
   localStorage.clear()
   ```

2. **Login to hospital account again**
   - Go to http://localhost:3000/hospital-login
   - Enter credentials
   - Should work without 401 errors now

3. **Test patient registration flow end-to-end**
   - Fill form → Next → Connect Provider
   - Should redirect to Epic login successfully

4. **Monitor browser console for errors**
   - No more "Failed to fetch"
   - No more 401 Unauthorized
   - All requests should be to `https://localhost:8000`

## Why This Happened

When we migrated the backend to HTTPS (to fix Epic OAuth), we forgot to update all the frontend pages to use the HTTPS endpoint. The `patient-register` and `fhir-callback` pages were updated initially, but `hospital-login` and `patient-login` were still hardcoded to use `http://localhost:8000`.

Now ALL pages use the `API_BASE` environment variable, making it easy to change the backend URL in one place (`.env.local`) instead of hunting through code! 🎯
