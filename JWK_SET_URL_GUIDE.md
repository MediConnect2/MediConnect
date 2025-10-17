# Epic FHIR JWK Set URL Configuration Guide

## What is a JWK Set URL?

**JWK (JSON Web Key) Set URL** is an endpoint that provides public keys used to verify:
- ID tokens (JWT tokens from OpenID Connect)
- Signed authorization responses
- Token signatures for security validation

Epic uses this for **asymmetric cryptography** - Epic signs tokens with their private key, and your app verifies them using Epic's public key.

---

## Your Epic App Configuration

### For Non-Production (Sandbox/Testing):

**Non-Production JWK Set URL:**
```
https://fhir.epic.com/interconnect-fhir-oauth/api/epic/2019/Security/Open/PublicKeys/530027/OIDC
```

### For Production:

**Production JWK Set URL:**
```
You'll get this when you move to production Epic environment
```

**Note:** The production URL will be different and provided by Epic when you:
1. Complete sandbox testing
2. Apply for production access
3. Get your production Client ID and Client Secret

---

## Where to Enter This in Epic

### Epic FHIR App Configuration Portal

1. **Log into Epic FHIR Portal:** https://fhir.epic.com/Developer/Apps

2. **Open Your App** (CLIENT_ID: `f38ed833-fe8c-420d-9989-54f14fd7376d`)

3. **Find the JWK Set URL Fields:**
   - Look for "Backend OAuth 2.0" or "JWT Configuration" section
   - Or "Asymmetric Client Authentication" section

4. **Enter the URLs:**

   **Non-Production JWK Set URL:**
   ```
   https://fhir.epic.com/interconnect-fhir-oauth/api/epic/2019/Security/Open/PublicKeys/530027/OIDC
   ```
   
   **Production JWK Set URL:**
   ```
   Leave blank or enter: TBD (will be provided when moving to production)
   ```

---

## Important Notes

### ⚠️ This is for **Backend Services** / **System-to-System** Authentication

**Do you need this?** Only if you're using:
- ❌ **JWT-based client authentication** (instead of client_secret)
- ❌ **Backend services authorization** (system/*.read scopes)
- ❌ **Bulk FHIR API** access

**Your current setup uses:**
- ✅ **`client_secret_basic`** authentication (simpler, username/password style)
- ✅ **User/patient context** OAuth flow
- ✅ **No JWT signing required**

### Current Authentication Method (from your code):
```python
oauth.register(
    name='ehr',
    client_id=settings.client_id,
    client_secret=settings.client_secret,  # Using client_secret, not JWT
    token_endpoint_auth_method='client_secret_basic',  # Not using JWT
    ...
)
```

---

## JWK Set URL Usage Scenarios

### Scenario 1: Your Current Setup (Client Secret Authentication)
**JWK Set URL Needed?** ❌ **NO**

Your app authenticates using:
```
Authorization: Basic base64(client_id:client_secret)
```

**What Epic uses JWK for in your flow:**
- Epic signs the ID token they send you (contains user info)
- Your app can optionally verify the signature using Epic's public key
- But most apps don't need to implement this verification

### Scenario 2: Backend Services (JWT Authentication)
**JWK Set URL Needed?** ✅ **YES**

If you were using JWT authentication:
1. Your app generates a JWT signed with YOUR private key
2. You register YOUR public key (JWK Set URL) with Epic
3. Epic verifies your JWT using your public key
4. Epic issues an access token

This is **more complex** but **more secure** for system-to-system access.

---

## What to Enter in Epic App Registration

### Option 1: If the field is OPTIONAL (most likely)
**Leave it blank** - You're using client_secret authentication, not JWT

### Option 2: If the field is REQUIRED
**Enter Epic's JWK URL** (even though you won't use it):
```
https://fhir.epic.com/interconnect-fhir-oauth/api/epic/2019/Security/Open/PublicKeys/530027/OIDC
```

### Option 3: If Epic asks for YOUR JWK Set URL
This means Epic wants you to use JWT authentication. Two choices:

**A. Keep using client_secret (recommended for your use case):**
- Select "Client Secret" authentication method
- Don't enter a JWK Set URL
- Keep your current code

**B. Switch to JWT authentication (more complex):**
- Generate your own public/private key pair
- Host your public key at a URL (e.g., `https://yourapp.com/.well-known/jwks.json`)
- Enter that URL in Epic
- Update your code to sign JWTs

---

## Recommendation for MediConnect

### For Your Use Case (EMT Patient Access):
✅ **Stick with client_secret authentication**
- Simpler to implement
- Easier to debug
- Sufficient security for user-context access
- No need to manage keys

### When to use JWK/JWT Authentication:
❌ Your current use case doesn't need it

✅ Use JWT authentication if you need:
- **Backend services** without user login
- **Bulk data export** (system-level access)
- **Scheduled background jobs** accessing FHIR
- **Higher security requirements** (no shared secrets)

---

## Summary: What to Enter

### In Epic FHIR App Configuration:

| Field | Value | Reason |
|-------|-------|--------|
| **Authentication Method** | `Client Secret` or `client_secret_basic` | Your current method |
| **Client Secret** | `HNBLKtPVWF6qORbKSjHwZ8i65lEO...` | Keep existing |
| **Non-Production JWK Set URL** | **Leave blank** or `https://fhir.epic.com/interconnect-fhir-oauth/api/epic/2019/Security/Open/PublicKeys/530027/OIDC` | Optional, not used by your app |
| **Production JWK Set URL** | **Leave blank** or `TBD` | Not needed yet |

### Your App Doesn't Need Changes
Your current code is correct for client_secret authentication:
```python
token_endpoint_auth_method='client_secret_basic'  # ✅ Correct
```

---

## If You See an Error About JWK

If Epic requires a JWK Set URL even though you're using client_secret:

**Enter this:**
```
https://fhir.epic.com/interconnect-fhir-oauth/api/epic/2019/Security/Open/PublicKeys/530027/OIDC
```

**Why:** Some Epic forms require this field, but it won't affect your client_secret authentication.

---

## Quick Reference

### Epic's JWK URLs (Sandbox/Non-Production):
```
https://fhir.epic.com/interconnect-fhir-oauth/api/epic/2019/Security/Open/PublicKeys/530027/OIDC
```

### To verify these keys are valid:
Visit the URL in your browser - you'll see Epic's public keys in JSON format:
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "...",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

---

## Need Help?

If you're unsure whether to enter a JWK Set URL:
1. Check if the field is marked "Required" or "Optional"
2. If optional → leave blank
3. If required → use Epic's JWK URL above
4. Your app will continue using client_secret (no code changes needed)

Your current OAuth flow doesn't require JWT authentication, so this field is likely just for future/advanced use cases.
