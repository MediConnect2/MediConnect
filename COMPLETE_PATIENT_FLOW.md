# Complete Patient Registration & Dashboard Flow

## Overview
After FHIR OAuth succeeds, patients go through a complete onboarding flow:
1. **FHIR Callback** - OAuth completes, data imported from Epic
2. **Complete Profile** - Collect missing information (email, phone, address, etc.)
3. **Patient Dashboard** - Display all medical data in organized tabs

---

## Flow Diagram

```
Patient Registration
       ↓
Connect to FHIR (Epic OAuth)
       ↓
Epic MyChart Login
       ↓
OAuth Callback (/callback)
   - Exchange code for token
   - Fetch FHIR data
   - Store in MongoDB
       ↓
Complete Profile (/complete-profile)
   - Collect email, phone
   - Emergency contact
   - Address
   - Insurance info
       ↓
Patient Dashboard (/patient-dashboard)
   - Overview tab (stats)
   - Allergies tab
   - Conditions tab
   - Medications tab
   - Procedures tab
   - Immunizations tab
   - Profile tab
```

---

## Pages Created

### 1. `/callback` (Updated)
**Purpose**: Handle Epic OAuth redirect and store FHIR data

**Changes**:
- After successful FHIR data import, redirects to `/complete-profile`
- Keeps `mediconnect_username` in localStorage for next page
- Shows success message: "Successfully connected! Imported X allergies, Y conditions..."

**User Experience**:
```
🔄 "Processing your healthcare provider connection..."
    ↓
✅ "Successfully connected to Epic! Imported 5 allergies, 3 conditions, 2 medications..."
    ↓
    (Auto-redirect after 2 seconds)
```

---

### 2. `/complete-profile` (New)
**Purpose**: Collect additional patient information not available from FHIR

**Features**:
- Pre-fills any existing data from database
- Encrypted storage for all fields
- Optional fields - can skip if patient doesn't want to provide
- Form sections:
  - 📞 **Contact Information** (email, phone)
  - 🚨 **Emergency Contact** (name, phone)
  - 🏠 **Address** (street, city, state, ZIP)
  - 💉 **Medical Information** (DOB, blood type)
  - 🏥 **Insurance** (provider, policy number)

**User Interface**:
- Clean white form on gradient background
- Two-column grid layout for compact display
- **Two buttons**:
  - **"Save & Continue"** - Saves data and goes to dashboard
  - **"Skip for Now"** - Goes directly to dashboard without saving

**Security**:
- All fields encrypted using AES-256-GCM
- Same encryption as patient registration data

---

### 3. `/patient-dashboard` (New)
**Purpose**: Main patient portal - displays all medical information

**Tab Structure**:

#### **Overview Tab**
- **Stats cards** showing counts:
  - 🤧 Allergies
  - 🏥 Conditions
  - 💊 Medications
  - 🔬 Observations
  - ⚕️ Procedures
  - 💉 Immunizations
- If not FHIR connected: Shows warning + "Connect Healthcare Provider" button

#### **Allergies Tab**
- Lists all allergies from FHIR data
- Shows full FHIR resource JSON (formatted)
- Empty state: "No allergies recorded"

#### **Conditions Tab**
- Lists all medical conditions
- Shows diagnosis dates, severity, status

#### **Medications Tab**
- Current and past medications
- Shows medication names, dosages, prescriber

#### **Procedures Tab**
- Surgical procedures, tests, treatments
- Shows procedure dates, descriptions

#### **Immunizations Tab**
- Vaccination history
- Shows vaccine names, dates administered

#### **Profile Tab**
- **Personal Information**: Name, DOB, blood type
- **Contact Information**: Email, phone, address
- **Healthcare Provider**: Connected provider name, status

**Design**:
- Clean, professional medical dashboard
- Color-coded sections (each tab has its own color)
- White cards on gray background
- Gradient header with patient name
- Logout button in header

---

## Backend Endpoints Added

### 1. `POST /patient/update-profile`
**Purpose**: Update patient profile with additional information

**Request Body**:
```json
{
  "mediconnect_username": "johndoe",
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "(555) 987-6543",
  "address_line1": "123 Main St",
  "address_line2": "Apt 4B",
  "city": "Boston",
  "state": "MA",
  "zip_code": "02101",
  "date_of_birth": "1990-01-15",
  "blood_type": "A+",
  "insurance_provider": "Blue Cross",
  "insurance_policy_number": "BC123456789"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Profile updated successfully"
}
```

**Security**:
- All fields encrypted before storage
- Uses same AES-256-GCM encryption as registration
- Sets `profile_completed: true` flag
- Records `profile_updated_at` timestamp

---

### 2. `GET /patient/profile/{username}`
**Purpose**: Retrieve complete patient profile (decrypted)

**Response**:
```json
{
  "mediconnect_username": "johndoe",
  "first_name": "John",
  "middle_name": "Michael",
  "last_name": "Doe",
  "driver_license_id": "D1234567",
  "fhir_connected": true,
  "profile_completed": true,
  "email": "john@example.com",
  "phone": "(555) 123-4567",
  "emergency_contact_name": "Jane Doe",
  "emergency_contact_phone": "(555) 987-6543",
  "address_line1": "123 Main St",
  "city": "Boston",
  "state": "MA",
  "date_of_birth": "1990-01-15",
  "blood_type": "A+",
  "provider_name": "Epic Sandbox",
  "fhir_patient_id": "egqBHVfQlt4Bw3XGXoxVxHg3",
  "fhir_data": {
    "patient": {...},
    "allergies": {...},
    "conditions": {...},
    "medications": {...},
    "observations": {...},
    "procedures": {...},
    "immunizations": {...}
  },
  "medical_data_summary": {
    "allergies_count": 5,
    "conditions_count": 3,
    "medications_count": 2,
    "observations_count": 15,
    "procedures_count": 1,
    "immunizations_count": 8
  }
}
```

**Features**:
- Decrypts all encrypted fields automatically
- Returns full FHIR data if connected
- Provides summary counts for quick overview
- Handles missing optional fields gracefully

---

## Complete User Journey

### Step 1: Hospital Registers Patient
```
Hospital staff logs in → Patient Register page
  ↓
Fills out form:
  - Username: lilpp
  - Password: ********
  - Name: Lilly Peterson
  - Driver License: 123456789
  - Use fingerprint: No
  ↓
Clicks "Next - Connect Healthcare Provider"
```

### Step 2: FHIR Connection
```
Backend generates FHIR login URL
  ↓
Patient redirected to Epic MyChart
  ↓
Patient logs in with Epic credentials (test user)
  ↓
Patient clicks "Allow access to medical records"
  ↓
Epic redirects to: https://localhost:8000/callback?code=XXX&state=YYY
```

### Step 3: Backend Processes OAuth
```
Backend receives callback
  ↓
Exchanges authorization code for access token
  ↓
Fetches comprehensive FHIR data:
  - Patient demographics
  - Allergies (5 entries)
  - Conditions (3 entries)
  - Medications (2 entries)
  - Observations (15 entries)
  - Procedures (1 entry)
  - Immunizations (8 entries)
  ↓
Stores all data in MongoDB (encrypted)
  ↓
Redirects to: http://localhost:3000/callback?session_id=fhir_lilpp_XXX&patient_id=YYY&status=success
```

### Step 4: Frontend Shows Success
```
Callback page loads
  ↓
Displays: "Fetching your medical records..."
  ↓
Calls /patient/link-fhir to complete storage
  ↓
Displays: "Successfully connected to Epic! Imported 5 allergies, 3 conditions, 2 medications..."
  ↓
Auto-redirects after 2 seconds
```

### Step 5: Complete Profile
```
/complete-profile page loads
  ↓
Shows form with sections:
  📞 Contact Information
  🚨 Emergency Contact
  🏠 Address
  💉 Medical Information
  🏥 Insurance
  ↓
Patient fills out form (or clicks "Skip for Now")
  ↓
Backend encrypts and stores all additional data
  ↓
Redirects to patient dashboard
```

### Step 6: Patient Dashboard
```
/patient-dashboard loads
  ↓
Header shows: "Welcome, Lilly Peterson"
              "✅ Connected to Epic Sandbox"
  ↓
Overview tab shows stats:
  🤧 Allergies: 5
  🏥 Conditions: 3
  💊 Medications: 2
  🔬 Observations: 15
  ⚕️ Procedures: 1
  💉 Immunizations: 8
  ↓
Patient can click tabs to view detailed medical records
  ↓
Profile tab shows all personal information
```

---

## Database Schema Updates

### Patient Document (MongoDB)
```javascript
{
  // Basic Registration (encrypted)
  "mediconnect_username": "lilpp",
  "hashed_password": "...",
  "first_name": { "ciphertext": "...", "nonce": "..." },
  "middle_name": { "ciphertext": "...", "nonce": "..." },
  "last_name": { "ciphertext": "...", "nonce": "..." },
  "driver_license_id": { "ciphertext": "...", "nonce": "..." },
  "use_fingerprint": false,
  "created_at": ISODate("2025-10-25T..."),
  
  // Profile Information (encrypted)
  "email": { "ciphertext": "...", "nonce": "..." },
  "phone": { "ciphertext": "...", "nonce": "..." },
  "emergency_contact_name": { "ciphertext": "...", "nonce": "..." },
  "emergency_contact_phone": { "ciphertext": "...", "nonce": "..." },
  "address_line1": { "ciphertext": "...", "nonce": "..." },
  "address_line2": { "ciphertext": "...", "nonce": "..." },
  "city": { "ciphertext": "...", "nonce": "..." },
  "state": { "ciphertext": "...", "nonce": "..." },
  "zip_code": { "ciphertext": "...", "nonce": "..." },
  "date_of_birth": { "ciphertext": "...", "nonce": "..." },
  "blood_type": { "ciphertext": "...", "nonce": "..." },
  "insurance_provider": { "ciphertext": "...", "nonce": "..." },
  "insurance_policy_number": { "ciphertext": "...", "nonce": "..." },
  
  // Status Flags
  "profile_completed": true,
  "profile_updated_at": ISODate("2025-10-25T..."),
  "registration_status": "completed",
  
  // FHIR Connection
  "fhir_connected": true,
  "fhir_patient_id": "egqBHVfQlt4Bw3XGXoxVxHg3",
  "provider_name": "Epic Sandbox",
  "fhir_last_updated": ISODate("2025-10-25T..."),
  "fhir_scope": "patient/Patient.r patient/Observation.r ...",
  
  // FHIR Data (comprehensive medical records)
  "fhir_data": {
    "patient": { /* FHIR Patient resource */ },
    "allergies": { /* Bundle of AllergyIntolerance resources */ },
    "conditions": { /* Bundle of Condition resources */ },
    "medications": { /* Bundle of MedicationRequest resources */ },
    "observations": { /* Bundle of Observation resources */ },
    "procedures": { /* Bundle of Procedure resources */ },
    "immunizations": { /* Bundle of Immunization resources */ }
  }
}
```

---

## Security Features

### Encryption
- **AES-256-GCM** for all PII and PHI
- Each field has unique nonce
- Key stored in environment variable (`AES_KEY`)

### Authentication
- JWT tokens for session management
- Bcrypt for password hashing
- Fingerprint authentication option (future)

### Data Protection
- All sensitive data encrypted at rest
- HTTPS for data in transit
- CSRF protection via OAuth state parameter
- Token expiration (3600 seconds)

---

## Files Modified/Created

### Frontend (Next.js)
1. ✅ **`src/app/callback/page.tsx`** - Updated to redirect to complete-profile
2. ✅ **`src/app/complete-profile/page.tsx`** - New profile completion form
3. ✅ **`src/app/patient-dashboard/page.tsx`** - New patient dashboard

### Backend (FastAPI)
1. ✅ **`server_end/main.py`** - Added profile endpoints:
   - `POST /patient/update-profile`
   - `GET /patient/profile/{username}`

---

## Testing Checklist

- [ ] Patient registration with FHIR connection
- [ ] Epic OAuth flow completes successfully
- [ ] FHIR data stored in MongoDB
- [ ] Redirect to complete-profile page
- [ ] Profile form pre-fills existing data
- [ ] Profile form encrypts and saves data
- [ ] "Skip for Now" button works
- [ ] Patient dashboard loads with correct data
- [ ] All tabs display correctly
- [ ] Stats cards show correct counts
- [ ] Profile tab shows all information
- [ ] Logout button works

---

## Next Steps / Future Enhancements

1. **Refresh FHIR Data**: Add button to re-sync with Epic
2. **Edit Profile**: Allow updating contact info from dashboard
3. **Document Upload**: Let patients upload additional documents
4. **Appointment Scheduling**: Integration with Epic scheduling
5. **Message Center**: Secure messaging with providers
6. **Health Goals**: Track health metrics and goals
7. **Share Records**: Generate shareable links for EMTs
8. **Print Summary**: Export medical summary as PDF

---

## API Endpoint Summary

### Patient Registration Flow
1. `POST /register` - Create patient account
2. `POST /fhir-login` - Initiate Epic OAuth
3. `GET /callback` - Handle Epic callback (redirects to frontend)
4. `POST /patient/link-fhir` - Fetch and store FHIR data

### Profile Management
5. `POST /patient/update-profile` - Add contact info, address, insurance
6. `GET /patient/profile/{username}` - Get complete patient profile

### Patient Login (Existing)
7. `POST /patient/login` - Login with username/password or fingerprint
8. `GET /verify-patient-token` - Verify JWT token

---

This creates a complete, professional patient onboarding and portal experience similar to real healthcare applications like Epic MyChart, Cerner, or Athenahealth! 🏥✨
