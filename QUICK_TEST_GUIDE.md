# 🚀 Quick Test Instructions

## Step-by-Step Testing Process

### 1️⃣ Start the Backend (Terminal 1)
```bash
cd /Users/aadisaraf/Documents/MediConnect/MediConnect/mediconnect-1
python start_https.py
```
Keep this running!

### 2️⃣ Login to Your App
1. Open browser: http://localhost:3000/fhir-access
2. Click "Patient Portal Login"
3. Use Epic credentials (e.g., `fhircamila` / `epicepic1`)
4. Complete OAuth authorization
5. Keep the browser tab open

### 3️⃣ Run the Test Script (Terminal 2)
```bash
cd /Users/aadisaraf/Documents/MediConnect/MediConnect/mediconnect-1
python3 test_scopes.py
```

### 4️⃣ Review the Results

The script will show you:
- ✅ Which scopes are **GRANTED** (working)
- ❌ Which scopes are **DENIED** (causing 403 errors)
- 🧪 Test results for each FHIR endpoint
- 🔧 Fix instructions

## Expected Output (Current State)

```
✅ PASS: Patient Demographics
✅ PASS: Allergies
❌ FAIL: Conditions (403 Forbidden)
❌ FAIL: Medications (403 Forbidden)
❌ FAIL: Vital Signs (403 Forbidden) ← THIS IS YOUR SMOKING HISTORY!
❌ FAIL: Procedures (403 Forbidden)
```

## What This Proves

**The test will show that:**
1. ✅ Your backend code is working correctly
2. ✅ Your authentication is working
3. ❌ Epic is rejecting requests because scopes aren't configured
4. ❌ The problem is in the Epic app, NOT your code

## After Fixing Epic App

After you:
1. Add the missing scopes in Epic app (https://fhir.epic.com/Developer/Apps)
2. Save the Epic app
3. Logout from your app
4. Login again (to get fresh token)

**Run the test again:**
```bash
python3 test_scopes.py
```

**Expected output:**
```
✅ PASS: Patient Demographics
✅ PASS: Allergies
✅ PASS: Conditions
✅ PASS: Medications
✅ PASS: Vital Signs ← NOW IT WORKS!
✅ PASS: Procedures

Total: 6 passed, 0 failed out of 6 tests

🎉 All tests passed! Your Epic app is properly configured!
```

---

**This automated test proves exactly where the problem is and confirms when it's fixed!**
