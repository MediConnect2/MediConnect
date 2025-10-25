# MediConnect FHIR Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Python 3.8+
- Epic FHIR sandbox account (optional for testing)

### Step 1: Install Dependencies

```bash
cd server_end
pip install -r requirements.txt
```

### Step 2: Configure Environment

The `.env` file is already configured with Epic sandbox credentials:
```properties
FHIR_SERVER_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
CLIENT_ID=1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
REDIRECT_URI=https://localhost:8000/fhir-callback
```

### Step 3: Start the Server

```bash
uvicorn main:app --reload --host localhost --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://localhost:8000
INFO:     Application startup complete.
```

### Step 4: Test the Integration

**Option A: Automated Test**
```bash
python test_fhir.py
```

**Option B: Interactive Example**
```bash
python example_fhir_client.py
```

**Option C: Manual cURL Test**
```bash
curl -X POST http://localhost:8000/fhir-login \
  -H "Content-Type: application/json" \
  -d '{"patient_username": "test_patient"}'
```

### Step 5: Complete Full Flow

1. **Initiate login:**
```python
import requests

response = requests.post('http://localhost:8000/fhir-login', 
    json={'patient_username': 'john_doe'})

data = response.json()
session_id = data['session_id']
redirect_url = data['redirect_url']
```

2. **Redirect user to Epic:**
```python
# In a web app:
return redirect(redirect_url)

# In CLI:
import webbrowser
webbrowser.open(redirect_url)
```

3. **Wait for callback:**
Epic will redirect to: `https://localhost:8000/fhir-callback?code=...&state=...&session_id=...`

4. **Fetch patient data:**
```python
response = requests.post('http://localhost:8000/fhir-request',
    json={'session_id': session_id})

patient_data = response.json()['data']

# Access specific data
print(patient_data['patient'])  # Demographics
print(patient_data['allergies'])  # Allergies
print(patient_data['observations'])  # Vital signs, labs
```

## 📋 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/fhir-login` | POST | Start OAuth flow |
| `/fhir-callback` | GET | OAuth callback |
| `/fhir-request` | POST | Get all data |
| `/fhir-resource` | POST | Get specific resource |
| `/fhir-logout` | POST | Clear session |

## 🔧 Common Issues

### "Connection refused"
- **Problem:** Server not running
- **Solution:** Run `uvicorn main:app --reload`

### "Session expired"
- **Problem:** Token expired or invalid session
- **Solution:** Call `/fhir-login` again

### "403 Forbidden" for observations
- **Problem:** Epic sandbox patient portal restrictions
- **Solution:** This is normal - Epic sandbox limits patient access. Will work in production.

## 📖 Next Steps

1. **Read full documentation:** See `FHIR_INTEGRATION_GUIDE.md`
2. **Test with Epic sandbox:** Use Epic test patient credentials
3. **Integrate with frontend:** Use the API in your React/Vue/Angular app
4. **Deploy to production:** Follow production deployment guide

## 🎯 Example: Fetch Allergies Only

```python
import requests

# 1. Login
response = requests.post('http://localhost:8000/fhir-login',
    json={'patient_username': 'patient123'})
session_id = response.json()['session_id']

# 2. Complete Epic login in browser...

# 3. Fetch only allergies
response = requests.post('http://localhost:8000/fhir-resource',
    json={
        'session_id': session_id,
        'resource_type': 'allergies'
    })

allergies = response.json()['data']
print(allergies)
```

## 🔒 Security Notes

- Always use HTTPS in production
- Tokens expire in 1 hour
- Session IDs should be kept secret
- In production, use Redis/database for token storage

## 📞 Support

- **Full Documentation:** `FHIR_INTEGRATION_GUIDE.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`
- **Epic FHIR Docs:** https://fhir.epic.com/Documentation

## ✅ Checklist

- [ ] Server running on port 8000
- [ ] `/fhir-login` returns session_id
- [ ] Can redirect to Epic login URL
- [ ] After Epic login, callback receives code
- [ ] `/fhir-request` returns patient data
- [ ] Can fetch specific resources
- [ ] Can logout and clear session

**You're all set! 🎉**

Start with `python test_fhir.py` to verify everything works!
