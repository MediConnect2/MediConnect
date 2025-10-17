# MediConnect Token Management & Persistent Access Analysis

## Current Implementation Status

### ❌ **Your App Does NOT Have Persistent Access**

Your application currently implements **session-based, temporary access only**.

---

## Detailed Analysis

### 1. **Persistent Access Requirement**

**Question:** Does the app require persistent access?

**Answer:** **YES, it should** - For an EMT emergency response application, persistent access would be beneficial because:
- ✅ EMTs need immediate access during emergencies (no time to re-authenticate)
- ✅ Reduces authentication friction in critical situations
- ✅ Allows background data sync and updates
- ✅ Enables offline capability planning

**Current Reality:** ❌ Your app does NOT implement persistent access

---

### 2. **Refresh Token Implementation**

**Question:** Does it use refresh tokens?

**Answer:** ❌ **NO** - Your application does not request or use refresh tokens.

#### Current Scopes:
```
openid fhirUser patient/Patient.read patient/Observation.read 
patient/Condition.read patient/AllergyIntolerance.read 
patient/MedicationRequest.read patient/Procedure.read 
patient/Immunization.read
```

#### Missing Scope:
❌ **`offline_access`** - Required to receive refresh tokens

#### What Epic Supports:
✅ Epic's SMART configuration shows `"permission-offline"` capability
✅ Epic supports `"grant_types_supported": ["authorization_code", "refresh_token", ...]`

---

### 3. **Rolling Refresh Tokens**

**Question:** Does it use rolling refresh tokens?

**Answer:** ❌ **NO** - Not implemented (because refresh tokens aren't used at all)

**What are rolling refresh tokens?**
- Each time you use a refresh token to get a new access token, you also get a new refresh token
- The old refresh token is invalidated
- Provides enhanced security by limiting refresh token lifetime

**Epic's Support:** Epic does support refresh tokens, but whether they're "rolling" depends on Epic's implementation (typically they are for security).

---

### 4. **Access Duration**

**Question:** Does the app have indefinite access?

**Answer:** ❌ **NO** - Access is LIMITED to the session duration

#### Current Token Storage:
```python
# From app/main.py callback function
request.session['token'] = token
request.session['patient_id'] = token.get('patient', None)
```

**Current Limitations:**
- ❌ Tokens stored in server-side session (temporary)
- ❌ Session expires when browser closes or server restarts
- ❌ No refresh token to renew access
- ❌ Access token expires (typically 1 hour for Epic)
- ❌ User must re-authenticate every time

**Typical Epic Access Token Lifetime:** ~60 minutes (1 hour)

---

## Current Flow vs. Persistent Access Flow

### Current Flow (Temporary Access):
```
1. EMT clicks "Login" → Redirect to Epic
2. Epic authenticates user
3. Epic redirects back with authorization code
4. App exchanges code for access_token (no refresh_token)
5. App stores access_token in session
6. EMT can access data for ~1 hour
7. ❌ After 1 hour or session end → Must re-authenticate from step 1
```

### Recommended Flow (Persistent Access):
```
1. EMT clicks "Login" → Redirect to Epic
2. Epic authenticates user
3. Epic redirects back with authorization code
4. App exchanges code for access_token + refresh_token
5. App stores tokens securely (encrypted database, not session)
6. EMT can access data for ~1 hour
7. ✅ After 1 hour → App uses refresh_token to get new access_token
8. ✅ Process repeats indefinitely (or until refresh_token expires/revoked)
```

---

## How to Add Persistent Access

### Step 1: Add `offline_access` Scope

Update your `.env`:
```properties
# Current:
FHIR_SCOPES=openid fhirUser patient/Patient.read patient/Observation.read patient/Condition.read patient/AllergyIntolerance.read patient/MedicationRequest.read patient/Procedure.read patient/Immunization.read

# Updated (add offline_access):
FHIR_SCOPES=openid fhirUser offline_access patient/Patient.read patient/Observation.read patient/Condition.read patient/AllergyIntolerance.read patient/MedicationRequest.read patient/Procedure.read patient/Immunization.read
```

### Step 2: Update Epic App Registration

In Epic FHIR portal, add these scopes:
- ✅ `offline_access`
- ✅ All existing scopes

### Step 3: Store Refresh Token Securely

**DO NOT store in session!** Use encrypted database storage:

```python
# Create a database table for tokens
class TokenStore:
    user_id: str
    access_token: str (encrypted)
    refresh_token: str (encrypted)
    expires_at: datetime
    token_type: str
    patient_id: str
```

### Step 4: Implement Token Refresh Logic

```python
async def refresh_access_token(refresh_token: str):
    """
    Use refresh token to get a new access token
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": settings.client_id,
                "client_secret": settings.client_secret
            },
            auth=(settings.client_id, settings.client_secret)
        )
        
        if response.status_code == 200:
            token_data = response.json()
            # Returns new access_token and possibly new refresh_token
            return token_data
        else:
            raise HTTPException(status_code=401, detail="Refresh token expired")
```

### Step 5: Auto-Refresh Before Expiration

```python
async def get_valid_access_token(user_id: str):
    """
    Get access token, refreshing if needed
    """
    token_store = get_token_from_database(user_id)
    
    # Check if access token is expired or expiring soon
    if token_store.expires_at < datetime.now() + timedelta(minutes=5):
        # Refresh the token
        new_tokens = await refresh_access_token(token_store.refresh_token)
        
        # Update database with new tokens
        update_tokens_in_database(user_id, new_tokens)
        
        return new_tokens['access_token']
    
    return token_store.access_token
```

---

## Epic's Refresh Token Policy

### Refresh Token Expiration:
- **Epic sandbox**: Refresh tokens typically expire after **1 year** of inactivity
- **Epic production**: Varies by organization policy (often 1 year, some indefinite)
- **Rolling refresh**: Epic may issue a new refresh token with each use (extends lifetime)

### When Refresh Tokens Are Revoked:
- ❌ User changes password
- ❌ Admin revokes app access
- ❌ Security breach detected
- ❌ Explicit revocation by user
- ❌ Long period of inactivity (1+ year without refresh)

---

## Security Considerations

### ✅ Best Practices:
1. **Encrypt tokens at rest** (database encryption)
2. **Use HTTPS only** (already implemented)
3. **Store refresh tokens separately** from access tokens
4. **Implement token rotation** (use new refresh token if provided)
5. **Monitor for suspicious activity**
6. **Provide user logout/revoke option**
7. **Handle token expiration gracefully**
8. **Don't log tokens** (security risk)

### ⚠️ Risks of Persistent Access:
- Stolen refresh tokens = long-term unauthorized access
- Must implement secure storage
- Need revocation mechanisms
- Compliance implications (HIPAA, etc.)

---

## Recommendations for MediConnect

### For Production:
✅ **Implement persistent access** - Emergency use case justifies it
✅ **Use `offline_access` scope**
✅ **Store refresh tokens in encrypted database**
✅ **Implement auto-refresh logic**
✅ **Set up token rotation**
✅ **Add manual token revocation endpoint**
✅ **Monitor and audit token usage**

### For Development/Testing:
- Current session-based approach is fine for testing
- Easier to debug and develop
- No persistent storage complexity
- But requires re-login frequently

---

## Summary Table

| Feature | Current Implementation | Epic Support | Recommended |
|---------|----------------------|--------------|-------------|
| **Persistent Access** | ❌ No | ✅ Yes | ✅ Implement |
| **Refresh Tokens** | ❌ No | ✅ Yes | ✅ Implement |
| **Rolling Refresh** | ❌ No | ✅ Likely | ✅ Implement |
| **Indefinite Access** | ❌ No (session only) | ⚠️ ~1 year | ✅ Implement |
| **`offline_access` Scope** | ❌ Not requested | ✅ Supported | ✅ Add |
| **Token Storage** | ⚠️ Session (temporary) | N/A | ✅ Database (encrypted) |
| **Auto-Refresh Logic** | ❌ Not implemented | N/A | ✅ Implement |
| **Access Duration** | ~1 hour (then re-auth) | ✅ Configurable | ✅ Extend to 1 year |

---

## Next Steps

1. **Decide:** Do you want persistent access for production?
   - **Yes** → Follow implementation guide above
   - **No** → Keep current session-based approach

2. **If implementing persistent access:**
   - Add `offline_access` scope
   - Set up database for token storage
   - Implement refresh token logic
   - Add token rotation
   - Test token refresh flow

3. **Update Epic app registration** with new scope

4. **Test thoroughly** with Epic sandbox

---

## Questions?

- **How long do Epic refresh tokens last?** ~1 year of inactivity (sandbox/production)
- **Are Epic refresh tokens rolling?** Likely yes (security best practice)
- **Can users revoke access?** Yes, through Epic MyChart or admin console
- **What happens if refresh token expires?** User must re-authenticate
- **Is indefinite access possible?** Effectively yes (~1 year, renewable indefinitely if used)

