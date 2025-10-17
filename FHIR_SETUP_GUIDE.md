# MediConnect FHIR Integration - Complete Setup Guide

## 📋 Overview

This guide will walk you through setting up the complete MediConnect application with FHIR integration for EMT access to patient medical records.

## 🎯 What You're Building

A healthcare application that allows EMTs to:
1. Authenticate using SMART on FHIR OAuth2
2. Access patient medical records from EHR systems
3. View comprehensive patient data including allergies, medications, conditions, and vital signs

## 🏗️ System Architecture

```
┌──────────────────┐
│   Next.js UI     │  (Port 3000)
│   (Frontend)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   FastAPI        │  (Port 8000)
│   (Backend)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   FHIR Server    │  (Epic/Cerner/etc.)
│   (EHR System)   │
└──────────────────┘
```

## 📦 Prerequisites

### Required Software
- **Python 3.9+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Git** - [Download](https://git-scm.com/)

### Required Accounts
- **Epic FHIR Developer Account** (for sandbox testing) - [Register here](https://fhir.epic.com/)
- OR **SMART Health IT Sandbox** (no registration needed) - [Visit here](https://launch.smarthealthit.org/)

## 🚀 Step-by-Step Setup

### Part 1: Register Your Application with FHIR Server

#### Option A: Epic Sandbox (Recommended)

1. **Create Epic FHIR Account**
   - Go to https://fhir.epic.com/
   - Click "Sign Up" and create an account
   - Verify your email

2. **Create a New App**
    - Go to "Build Apps" → "Create"
    - Fill in app details:
       - **App Name**: MediConnect
       - **Application Audience**: Clinicians
       - **FHIR Specification**: R4
       - **Application Type**: Confidential Client using *Authorization Code* (User Authentication)

3. **Configure OAuth Settings**
   - **Redirect URI**: `http://127.0.0.1:8000/callback`
   - **Launch URI**: Leave blank (we're not using EHR launch)
   - **SMART on FHIR Version**: SMART on FHIR v1 or v2
   - Move every required scope from **Available** to **Selected** in the Epic UI right away—the app will only request scopes that appear in the right-hand list.

4. **Enable the OAuth 2.0 Authorization Code flow**
   - Save the app, reopen it, and switch to the **Capabilities** tab.
   - Under **OAuth 2.0 Capabilities** (sometimes shown under *Additional Options → OAuth 2.0*), check **OAuth 2 Authorization Code**.
   - Leave **OAuth 2 Client Credentials** unchecked unless you also need backend service access.
   - Keep **Is Confidential Client** enabled—the sandbox uses confidential clients for this flow.

5. **Select Scopes**
   Check these scopes:
   - `openid`
   - `fhirUser`
   - `launch/patient`
   - `patient/Patient.read`
   - `patient/Observation.read`
   - `patient/Condition.read`
   - `patient/AllergyIntolerance.read`
   - `patient/MedicationRequest.read`
   - `patient/Procedure.read`
   - `patient/Immunization.read`

6. **Save Credentials**
   - Copy your **Client ID**
   - Copy your **Client Secret**
   - ⚠️ **IMPORTANT**: Save these securely! You'll need them in the next steps.

7. **Get Your Endpoints**
   - Note the FHIR Base URL (usually `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4`)

#### Option B: SMART Health IT Sandbox (Quick Testing)

For quick testing without registration:
- FHIR Server URL: `https://launch.smarthealthit.org/v/r4/fhir`
- Use their built-in authentication (no client_id/secret needed for public client)
- Note: This is for testing only, not production

### Part 2: Setup FastAPI Backend

1. **Navigate to Backend Directory**
   ```bash
   cd mediconnect-1
   ```

2. **Create Virtual Environment**
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # Mac/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create Environment File**
   ```bash
   # Copy the example
   copy .env.example .env   # Windows
   cp .env.example .env     # Mac/Linux
   ```

5. **Configure Environment Variables**
   Edit `.env` file with your credentials:
   ```bash
   # FHIR Server Configuration
   FHIR_SERVER_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
   
   # OAuth2 Credentials (from Epic registration)
   CLIENT_ID=763ceaf5-991d-41cd-8f2f-5bcace91a2f8
   CLIENT_SECRET=aR9U1wiNLYWojDGSjjfkXAnTRl4L750YtpMDaUfAvfWo7TyzwYFoXc59s05FzZCUXQOPrZV4FRvt6rhLeV0OAw==
   
   # Redirect URI (must match what you registered)
   REDIRECT_URI=http://127.0.0.1:8000/callback
   
   # Session Secret (generate a random string)
   SESSION_SECRET_KEY="drkcXZX2R5Xq8dkkqvvx4LvDqe8XoRkaSTnDZxmRjew"
   JWT_SECRET_KEY = "tm3Dry8yk97+6ktSB2Op+P02dpVQF2RyXWFuYGnBxWg="
   
   # Application Settings
   APP_NAME=MediConnect
   APP_VERSION=1.0.0
   
   # CORS Origins
   CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   
   DEBUG=True
   ```

6. **Generate Secure Session Key**
   ```bash
   # Run this in Python to generate a secure random key
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   Copy the output and use it as your `SESSION_SECRET_KEY`

7. **Start the FastAPI Server**
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

8. **Verify Backend is Running**
   - Open browser: http://127.0.0.1:8000
   - You should see: `{"message": "Welcome to the MediConnect API", ...}`
   - Check API docs: http://127.0.0.1:8000/docs

### Part 3: Setup Next.js Frontend

1. **Open New Terminal** (keep FastAPI running)

2. **Navigate to Frontend Directory**
   ```bash
   cd mediconnect
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Verify Frontend is Running**
   - Open browser: http://localhost:3000
   - You should see the MediConnect homepage

### Part 4: Test the FHIR Integration

1. **Access the FHIR Page**
   - Navigate to: http://localhost:3000/fhir-access

2. **Initiate Login**
   - Click "Login with EHR System"
   - You'll be redirected to the Epic login page (or SMART Health IT)

3. **Authenticate**
   - **For Epic Sandbox**:
     - Use the test credentials provided by Epic
     - Select a test patient
   
   - **For SMART Health IT**:
     - Choose a sample patient from the list
     - No password needed

4. **View Patient Data**
   - After successful authentication, you'll be redirected back to the app
   - Click "Load Patient Data"
   - You should see comprehensive patient information!

## 🧪 Testing with Sample Data

### Epic Sandbox Test Patients

Epic provides test patients for development:
- Patient ID: `Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB`
- Name: Derrick Lin
- Use Epic's test credentials to access

### SMART Health IT Sample Patients

The SMART sandbox provides multiple test patients with different conditions, medications, and allergies.

## 📊 Available Endpoints

### Authentication Endpoints
- `GET /login` - Initiate OAuth2 login
- `GET /callback` - OAuth2 callback handler
- `GET /api/auth-status` - Check authentication status
- `POST /api/logout` - Logout and clear session

### Patient Data Endpoints
- `GET /api/patient-info` - Get comprehensive patient data
- `GET /api/patient/{patient_id}` - Get patient demographics
- `GET /api/conditions` - Get medical conditions
- `GET /api/allergies` - Get allergies (CRITICAL for EMTs!)
- `GET /api/medications` - Get current medications
- `GET /api/vital-signs` - Get vital signs
- `GET /api/procedures` - Get procedure history
- `GET /api/current-patient` - Get current patient context

## 🔧 Troubleshooting

### Issue: "Import could not be resolved" errors

**Solution**: Install packages in virtual environment
```bash
# Activate venv first
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# Then install
pip install -r requirements.txt
```

### Issue: "Not authenticated" error

**Solution**: Check session cookies
- Make sure you're using `credentials: 'include'` in fetch requests
- Verify `SESSION_SECRET_KEY` is set in `.env`
- Clear browser cookies and try again

### Issue: OAuth redirect fails

**Solution**: Verify redirect URI
- Must exactly match what you registered: `http://127.0.0.1:8000/callback`
- Check for http vs https
- Check for trailing slashes

### Issue: CORS errors

**Solution**: Check CORS configuration
- Verify `CORS_ORIGINS` in `.env` includes your frontend URL
- Make sure both servers are running on correct ports
- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000`

### Issue: "Failed to fetch patient data"

**Solution**: Check token and scopes
- Verify all required scopes are selected in Epic app registration
- Check that access token is valid (not expired)
- Look at FastAPI logs for detailed error messages

## 📚 Understanding FHIR Resources

### Patient Resource
- Basic demographics (name, DOB, gender, address)
- Identifiers (MRN, SSN, etc.)

### Condition Resource
- Medical diagnoses and problems
- Clinical status (active, resolved, etc.)
- Onset dates

### AllergyIntolerance Resource
- ⚠️ **CRITICAL for EMTs**
- Allergen name
- Reaction type and severity
- Clinical status

### MedicationRequest Resource
- Current and past medications
- Dosage and frequency
- Status (active, stopped, etc.)

### Observation Resource
- Vital signs (BP, HR, temp, etc.)
- Lab results
- Clinical measurements

### Procedure Resource
- Surgical and medical procedures
- Dates performed
- Outcomes

### Immunization Resource
- Vaccination history
- Dates administered
- Vaccine types

## 🔐 Security Best Practices

### For Development
1. ✅ Use sandbox/test environments only
2. ✅ Never commit `.env` file to Git
3. ✅ Use test patient data only
4. ✅ Keep client secrets secure

### For Production (Future)
1. ⚠️ Implement HTTPS/TLS everywhere
2. ⚠️ Use production-grade session storage (Redis, database)
3. ⚠️ Implement proper logging (without PHI)
4. ⚠️ Add rate limiting
5. ⚠️ Complete HIPAA compliance assessment
6. ⚠️ Sign Business Associate Agreements
7. ⚠️ Implement audit logging
8. ⚠️ Add multi-factor authentication
9. ⚠️ Use Web Application Firewall (WAF)
10. ⚠️ Regular security audits

## 📖 Next Steps

### Immediate Improvements
1. **Add Patient Search**
   - Implement search by name, DOB, MRN
   - For unconscious patients: QR code scanning

2. **Enhance Data Display**
   - Better formatting for EMT use
   - Color-coded alerts for critical information
   - Quick-reference cards

3. **Add Offline Support**
   - Cache critical patient data
   - Sync when connection restored

4. **Mobile Optimization**
   - Responsive design for tablets
   - Touch-friendly interface
   - Barcode/QR scanning

### Production Readiness
1. **Legal & Compliance**
   - HIPAA compliance audit
   - Business Associate Agreements
   - Privacy policies
   - Terms of service

2. **Security Hardening**
   - Penetration testing
   - Security audit
   - Implement all production security measures

3. **Scalability**
   - Load balancing
   - Database optimization
   - Caching strategies
   - CDN for frontend

4. **Monitoring**
   - Application monitoring (Datadog, New Relic)
   - Error tracking (Sentry)
   - Uptime monitoring
   - Performance metrics

## 🎓 Learning Resources

### FHIR & SMART on FHIR
- [FHIR Documentation](https://www.hl7.org/fhir/)
- [SMART on FHIR Docs](https://docs.smarthealthit.org/)
- [HL7 FHIR University](https://www.hl7.org/fhir/overview.html)

### Healthcare IT
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/index.html)
- [Healthcare IT Standards](https://www.healthit.gov/isa/)

### Implementation Guides
- [Epic FHIR Documentation](https://fhir.epic.com/)
- [Cerner FHIR Documentation](https://fhir.cerner.com/)
- [Argonaut Project](http://argonautwiki.hl7.org/)

## ✅ Checklist

- [ ] Python 3.9+ installed
- [ ] Node.js 18+ installed
- [ ] Registered app with Epic FHIR (or using SMART sandbox)
- [ ] Created `.env` file with credentials
- [ ] Installed Python dependencies
- [ ] Installed Node.js dependencies
- [ ] FastAPI server running on port 8000
- [ ] Next.js server running on port 3000
- [ ] Successfully logged in via OAuth
- [ ] Successfully retrieved patient data
- [ ] Tested all major endpoints
- [ ] Reviewed security considerations

## 🆘 Getting Help

### Documentation
- Check `mediconnect-1/README.md` for API details
- Review FastAPI docs at `http://127.0.0.1:8000/docs`
- Read FHIR specifications at https://www.hl7.org/fhir/

### Community Support
- **FHIR Community**: https://chat.fhir.org/
- **Epic Developer Forum**: https://fhir.epic.com/
- **SMART on FHIR**: https://groups.google.com/forum/#!forum/smart-on-fhir

### Common Issues
- Check FastAPI terminal for error logs
- Check browser console for frontend errors
- Verify all environment variables are set correctly
- Ensure both servers are running
- Check that ports 3000 and 8000 are not blocked

## 🎉 Success!

If you've followed this guide, you now have a working FHIR-integrated healthcare application! 

Remember:
- 🧪 This is for **development/testing only**
- 🏥 Never use with real patient data without proper authorization
- 🔒 Production deployment requires extensive security measures
- ⚖️ Must comply with HIPAA and other healthcare regulations

---

**Built with ❤️ for EMTs and emergency healthcare providers**
