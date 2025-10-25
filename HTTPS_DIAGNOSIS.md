# 🔧 HTTPS Diagnosis & Fix for Hospital Login

## Current Issue
Getting "Invalid HTTP request" warnings when visiting hospital-login page, meaning the page is calling HTTP instead of HTTPS.

## ✅ What I Fixed

1. **Restarted Next.js server** - Environment variables only load at startup
2. **Added debug logging** - Hospital login now logs the API URL it's using
3. **Created test page** - http://localhost:3000/env-test to verify environment variables

## 🧪 How to Diagnose

### Step 1: Check Environment Variable
Open http://localhost:3000/env-test in your browser

**Expected:** `NEXT_PUBLIC_API_BASE: https://localhost:8000`  
**If you see:** `NOT SET` → Environment variable not loading

### Step 2: Check Browser Console
1. Open http://localhost:3000/hospital-login
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for these debug messages:
   ```
   🔍 API_BASE: https://localhost:8000
   🔍 Full URL: https://localhost:8000/verify-hospital-token
   ```

**If you see:**
- ✅ `https://localhost:8000` → Correct, using HTTPS
- ❌ `http://localhost:8000` → Wrong, .env.local not loaded
- ❌ `undefined` → Environment variable not set

### Step 3: Check Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Visit hospital-login page
4. Look at the request to `/verify-hospital-token`

**Expected:** 
- Request URL: `https://localhost:8000/verify-hospital-token`
- Status: 401 (Unauthorized is OK - means HTTPS is working)

**If you see:**
- ❌ Request URL: `http://localhost:8000/...` → Environment not loaded
- ❌ Failed to load → CORS or SSL issue

## 🔧 Solutions

### Solution 1: Verify .env.local Exists
```bash
cat mediconnect/.env.local
```

**Should show:**
```
NEXT_PUBLIC_API_BASE=https://localhost:8000
```

**If missing, create it:**
```bash
echo "NEXT_PUBLIC_API_BASE=https://localhost:8000" > mediconnect/.env.local
```

### Solution 2: Restart Next.js (CRITICAL!)
```bash
# Kill existing
pkill -f "next dev"

# Start fresh
cd mediconnect
npm run dev
```

**Note:** Next.js ONLY loads .env.local at startup. Changes require restart!

### Solution 3: Clear Browser Cache
```bash
# Visit this page
http://localhost:3000/clear-cache.html

# Or in browser console:
localStorage.clear()
sessionStorage.clear()
```

### Solution 4: Hard Reload Browser
After restarting Next.js:
- Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Firefox: Ctrl+F5 or Cmd+Shift+R

## 🎯 Expected Results After Fix

### Browser Console (hospital-login):
```
🔍 API_BASE: https://localhost:8000
🔍 Full URL: https://localhost:8000/verify-hospital-token
```

### Network Tab:
```
Request URL: https://localhost:8000/verify-hospital-token
Request Method: GET
Status Code: 401 Unauthorized (or 200 if token is valid)
```

### Backend Logs:
```
INFO:     127.0.0.1:xxxxx - "GET /verify-hospital-token HTTP/1.1" 401 Unauthorized
```

**NO MORE:** `WARNING: Invalid HTTP request received`

## 🔍 Common Causes

### Cause 1: Next.js Not Restarted
**Symptom:** .env.local exists but variable shows as undefined  
**Fix:** Kill and restart Next.js

### Cause 2: .env.local in Wrong Location
**Wrong:** `/MediConnect/.env.local`  
**Correct:** `/MediConnect/mediconnect/.env.local`  
**Fix:** Move file to correct location

### Cause 3: Typo in Environment Variable Name
**Wrong:** `NEXT_PUBLIC_API_URL` or `API_BASE`  
**Correct:** `NEXT_PUBLIC_API_BASE` (must start with `NEXT_PUBLIC_`)  
**Fix:** Correct the variable name

### Cause 4: Browser Cached Old Code
**Symptom:** Shows HTTP even after restart  
**Fix:** Hard reload browser (Cmd+Shift+R)

## ✅ Verification Checklist

- [ ] .env.local exists in `mediconnect/` folder
- [ ] File contains: `NEXT_PUBLIC_API_BASE=https://localhost:8000`
- [ ] Next.js server restarted after creating/editing .env.local
- [ ] Browser hard-reloaded (Cmd+Shift+R)
- [ ] Browser console shows: `🔍 API_BASE: https://localhost:8000`
- [ ] Network tab shows HTTPS requests
- [ ] No "Invalid HTTP request" warnings in backend logs

## 📊 Debug Commands

```bash
# Check if .env.local exists
ls -la mediconnect/.env.local

# View contents
cat mediconnect/.env.local

# Check Next.js process
ps aux | grep "next dev"

# Kill all Next.js processes
pkill -f "next dev"

# Start Next.js with visible output (for debugging)
cd mediconnect && npm run dev

# Check backend HTTPS server
ps aux | grep uvicorn | grep ssl
```

## 🚀 Quick Fix (All Steps)

```bash
# 1. Ensure .env.local exists
echo "NEXT_PUBLIC_API_BASE=https://localhost:8000" > mediconnect/.env.local

# 2. Kill Next.js
pkill -f "next dev"

# 3. Start Next.js
cd mediconnect && npm run dev

# 4. Wait 5 seconds
sleep 5

# 5. Open browser and check console at:
# http://localhost:3000/hospital-login
```

## 📝 What Changed

**Before:**
- Environment variable might not be loading
- Page possibly using fallback or undefined

**After:**
- ✅ Added debug logging to see actual URL
- ✅ Restarted Next.js to load environment
- ✅ Created test page to verify env vars
- ✅ All pages should now use HTTPS

## Next Steps

1. **Visit:** http://localhost:3000/env-test
   - Verify it shows `https://localhost:8000`

2. **Visit:** http://localhost:3000/hospital-login
   - Open console (F12)
   - Check for `🔍 API_BASE: https://localhost:8000`

3. **Check backend logs**
   - Should see proper HTTPS GET requests
   - No more "Invalid HTTP request" warnings

If you still see issues, share the console output from the browser and I'll help debug further!
