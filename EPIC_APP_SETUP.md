# Epic FHIR App Configuration Checklist

## ⚠️ OAuth2 Error: "Something went wrong trying to authorize the client"

This error means Epic is rejecting your authorization request. The issue is in your Epic app registration settings.

## 🔧 Fix Steps (Do ALL of these)

### Step 1: Log into Epic FHIR Portal
1. Go to: https://fhir.epic.com/Developer/Apps
2. Find app with CLIENT_ID: `f38ed833-fe8c-420d-9989-54f14fd7376d`
3. Click **"Edit Application"**

### Step 2: Application Type
✅ Select: **"Confidential (Backend Client)"**
❌ NOT: "Public Client"

### Step 3: OAuth 2.0 Redirect URIs (CRITICAL!)
**This is the most common cause of the error.**

1. Look for the "OAuth 2.0 Redirect URIs" or "Redirect URIs" section
2. **Delete** any existing redirect URIs that don't match exactly
3. **Add** this EXACT URI (copy/paste to avoid typos):
   ```
   https://localhost:8000/callback
   ```

**Important Requirements:**
- ✅ Must use `https://` (not http://)
- ✅ Must use `localhost` (not 127.0.0.1)
- ✅ Must include port `:8000`
- ✅ Must end with `/callback`
- ❌ NO trailing slash (`/callback/` is wrong)
- ❌ NO extra spaces or characters
- ⚠️ Case-sensitive (use lowercase)

### Step 4: OAuth 2.0 Grant Types
✅ Check: **"Authorization Code"**
✅ (Optional): "Client Credentials"

### Step 5: Scopes Configuration
**IMPORTANT**: You must MANUALLY move each scope from "Available" to "Selected"

Move these scopes to the **"Selected"** column:
- `openid` ✅
- `fhirUser` ✅
- `patient/Patient.read` ✅
- `patient/Observation.read` ✅
- `patient/Condition.read` ✅
- `patient/AllergyIntolerance.read` ✅
- `patient/MedicationRequest.read` ✅
- `patient/Procedure.read` ✅
- `patient/Immunization.read` ✅

**Note about `launch/patient`:**
- Some Epic sandboxes don't support `launch/patient` scope
- If you see it available, add it
- If not available, skip it (I've already removed it from your config)

### Step 6: Save
1. Scroll to bottom
2. Click **"Save"** or **"Save & Build"**
3. Wait for confirmation message

### Step 7: Verify Client Credentials
After saving:
1. Copy the **Client ID** - should match: `f38ed833-fe8c-420d-9989-54f14fd7376d`
2. Copy the **Client Secret** - should match your .env file
3. If Epic regenerated the secret, update your `.env` file

## 🧪 Test Again

After making these changes in Epic:

1. Go to: `http://localhost:3000/fhir-access`
2. Click **"Login with EHR System"**
3. You should be redirected to Epic's login page
4. Complete Epic authentication
5. Accept the SSL certificate warning in your browser
6. You should be redirected back successfully

## 📋 Common Mistakes

| ❌ Wrong | ✅ Correct |
|---------|----------|
| `http://localhost:8000/callback` | `https://localhost:8000/callback` |
| `https://127.0.0.1:8000/callback` | `https://localhost:8000/callback` |
| `https://localhost:8000/callback/` | `https://localhost:8000/callback` |
| `https://localhost/callback` | `https://localhost:8000/callback` |
| Scopes in "Available" | Scopes in "Selected" |
| Public Client | Confidential Client |

## 🔍 Additional Checks

### If error persists, verify:

1. **Client Secret is correct**
   - Compare the secret in Epic with your `.env` file
   - No extra spaces or line breaks
   - Copy/paste exactly as shown in Epic

2. **App is Active/Published**
   - Some Epic portals require you to "publish" or "activate" the app
   - Look for an "Active" or "Published" status indicator

3. **No IP/Domain Restrictions**
   - Check if Epic has any IP whitelist settings
   - Make sure `localhost` is allowed

4. **Epic Environment**
   - Confirm you're using the correct Epic environment (sandbox vs production)
   - URL: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`

## 📞 Still Getting Error?

If you've done ALL the above and still see the OAuth error:

1. Take a screenshot of your Epic app configuration (all sections)
2. Check Epic's app activity logs (if available)
3. Try creating a NEW Epic app with the correct settings from scratch
4. Contact Epic FHIR support with your Client ID

## ✅ Success Indicators

You'll know it works when:
- No "OAuth2 Error" page from Epic
- Your backend logs show: `INFO: 127.0.0.1:xxxxx - "GET /callback?code=..."`
- You're redirected to: `http://localhost:3000/fhir-access`
- Patient data appears on the page

## 📝 Current Configuration Status

Your local setup is correct:
- ✅ Backend running with HTTPS
- ✅ Frontend configured for HTTPS backend
- ✅ SSL certificates generated
- ✅ Environment variables set correctly
- ✅ Scopes updated (removed problematic `launch/patient`)

**The only issue is the Epic app registration settings.**
