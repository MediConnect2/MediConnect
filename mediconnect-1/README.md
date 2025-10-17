# MediConnect - FHIR Integration Backend

MediConnect is a FastAPI-based backend application that enables EMTs to quickly access patient medical information through FHIR (Fast Healthcare Interoperability Resources) APIs using the SMART on FHIR authorization framework.

## 🎯 Purpose

This application allows Emergency Medical Technicians (EMTs) to:
- Securely authenticate using SMART on FHIR OAuth2 protocol
- Access patient medical records from EHR systems (Epic, Cerner, etc.)
- View comprehensive patient data including:
  - Demographics
  - Medical conditions
  - Allergies and intolerances
  - Current medications
  - Vital signs
  - Procedure history
  - Immunization records

## 🏗️ Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Next.js   │────────▶│   FastAPI    │────────▶│   FHIR      │
│  Frontend   │         │   Backend    │         │   Server    │
│   (EMT UI)  │◀────────│  (OAuth2)    │◀────────│  (EHR)      │
└─────────────┘         └──────────────┘         └─────────────┘
```

### Flow:
1. EMT clicks "Login with EHR" in Next.js frontend
2. Frontend redirects to FastAPI `/login` endpoint
3. FastAPI initiates OAuth2 flow with FHIR server
4. EMT authenticates with EHR credentials
5. EHR redirects back with authorization code
6. FastAPI exchanges code for access token
7. FastAPI stores token in secure session
8. EMT can now request patient data via FastAPI endpoints

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- pip
- Virtual environment (recommended)

### Installation

1. Clone the repository and navigate to the mediconnect-1 directory:

```bash
cd mediconnect-1
```

2. Create and activate a virtual environment:

```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Configure environment variables:

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your credentials
```

### Configuration

Edit the `.env` file with your FHIR server details:

```bash
# FHIR Server URL (sandbox or production)
FHIR_SERVER_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4

# OAuth2 Credentials (get these from your EHR vendor)
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret

# Redirect URI (must match registration)
REDIRECT_URI=http://127.0.0.1:8000/callback

# Session Security
SESSION_SECRET_KEY=generate-a-random-secret-key-here
```

### Register Your Application

Before you can use this application, you must register it with a FHIR server:

#### Option 1: Epic Sandbox (Recommended for Development)

1. Visit [Epic FHIR](https://fhir.epic.com/)
2. Create a developer account
3. Register a new app with these settings:
   - **Application Type**: Confidential Client
   - **Redirect URI**: `http://127.0.0.1:8000/callback`
   - **SMART Scopes**: 
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
4. Save your `CLIENT_ID` and `CLIENT_SECRET`

#### Option 2: SMART Health IT Sandbox

1. Visit [SMART Health IT](https://launch.smarthealthit.org/)
2. Use their public sandbox for testing
3. No registration required for basic testing

### Running the Application

Start the FastAPI server:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API will be available at:
- **API**: http://127.0.0.1:8000
- **Documentation**: http://127.0.0.1:8000/docs
- **Alternative Docs**: http://127.0.0.1:8000/redoc

## 📚 API Endpoints

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login` | GET | Initiates OAuth2 login flow |
| `/callback` | GET | OAuth2 callback (handles redirect) |
| `/api/auth-status` | GET | Check authentication status |
| `/api/logout` | POST | Clear session and logout |

### Patient Data Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/patient-info` | GET | Get comprehensive patient data |
| `/api/patient/{patient_id}` | GET | Get patient demographics |
| `/api/conditions` | GET | Get patient conditions |
| `/api/allergies` | GET | Get patient allergies |
| `/api/medications` | GET | Get current medications |
| `/api/vital-signs` | GET | Get vital signs |
| `/api/procedures` | GET | Get procedure history |
| `/api/current-patient` | GET | Get current patient context |

### Example Usage

1. **Login Flow** (from frontend):
```javascript
// Redirect user to login endpoint
window.location.href = 'http://127.0.0.1:8000/login';
```

2. **Fetch Patient Data** (after authentication):
```javascript
const response = await fetch('http://127.0.0.1:8000/api/patient-info', {
  credentials: 'include' // Important: include session cookies
});
const patientData = await response.json();
```

3. **Check Auth Status**:
```javascript
const response = await fetch('http://127.0.0.1:8000/api/auth-status', {
  credentials: 'include'
});
const status = await response.json();
console.log(status.authenticated); // true or false
```

## 🔐 Security Considerations

### HIPAA Compliance

⚠️ **CRITICAL**: This application handles Protected Health Information (PHI). You MUST:

1. **Encryption**:
   - Use HTTPS in production (TLS/SSL)
   - Encrypt data at rest
   - Use secure session storage

2. **Access Control**:
   - Implement proper authentication
   - Use role-based access control (RBAC)
   - Audit all data access

3. **Data Handling**:
   - Never log PHI
   - Implement data retention policies
   - Use Business Associate Agreements (BAA)

4. **Production Deployment**:
   - Use environment-specific configs
   - Rotate credentials regularly
   - Implement monitoring and alerting

### Best Practices

- Never commit `.env` file to version control
- Use strong, unique `SESSION_SECRET_KEY`
- Keep `CLIENT_SECRET` secure
- Implement rate limiting
- Add request logging (without PHI)
- Use CORS properly (restrict origins)

## 🧪 Testing

Run tests:

```bash
pytest tests/
```

Test with sample data:

```bash
# Use SMART Health IT sandbox which provides test patients
FHIR_SERVER_URL=https://launch.smarthealthit.org/v/r4/fhir
```

## 📖 FHIR Resources

- [FHIR Specification](https://www.hl7.org/fhir/)
- [SMART on FHIR](https://docs.smarthealthit.org/)
- [Epic FHIR Documentation](https://fhir.epic.com/)
- [Cerner FHIR Documentation](https://fhir.cerner.com/)

## 🛠️ Development

### Project Structure

```
mediconnect-1/
├── app/
│   ├── main.py                 # FastAPI application & OAuth setup
│   ├── api/
│   │   └── endpoints/
│   │       ├── fhir.py         # FHIR data endpoints
│   │       └── patients.py     # Patient search endpoints
│   ├── core/
│   │   └── config.py           # Configuration settings
│   ├── models/
│   │   └── patient.py          # Pydantic models
│   └── services/
│       └── fhir_service.py     # FHIR API client service
├── tests/
│   └── test_api.py
├── requirements.txt
├── .env.example
└── README.md
```

### Adding New FHIR Resources

To add support for additional FHIR resources:

1. Add method to `FHIRService` class in `fhir_service.py`
2. Add endpoint to `fhir.py`
3. Add corresponding model to `patient.py`
4. Update documentation

Example:
```python
# In fhir_service.py
async def fetch_diagnostic_reports(self, patient_id: str, access_token: str):
    url = f"{self.base_url}/DiagnosticReport"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/fhir+json"
    }
    params = {"patient": patient_id}
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        return response.json()
```

## 🚨 Production Deployment

### Checklist

- [ ] Register app with production EHR system
- [ ] Obtain production credentials
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure proper CORS origins
- [ ] Implement database for session storage
- [ ] Add comprehensive logging (no PHI)
- [ ] Set up monitoring and alerts
- [ ] Implement rate limiting
- [ ] Complete HIPAA security assessment
- [ ] Sign Business Associate Agreements
- [ ] Set up backup and disaster recovery
- [ ] Implement audit logging
- [ ] Configure production environment variables

### Production Server

Use a production-ready server like Gunicorn with Uvicorn workers:

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

This is a healthcare application handling sensitive data. All contributions must follow:
- HIPAA compliance guidelines
- Security best practices
- Code review process
- Testing requirements

## 📞 Support

For issues related to:
- **FHIR API**: Contact your EHR vendor
- **SMART on FHIR**: Visit https://chat.fhir.org/
- **Application bugs**: Open an issue in this repository

---

**⚠️ DISCLAIMER**: This application is intended for use by authorized healthcare professionals only. Ensure proper authorization and compliance with all applicable healthcare regulations before accessing patient data.

## Features

- Integration with FHIR to access patient information.
- OAuth authentication for secure access to Electronic Health Records (EHR).
- API endpoints for fetching patient data.

## Project Structure

```
mediconnect
├── app
│   ├── main.py                # Entry point of the FastAPI application
│   ├── api                    # API module containing endpoints
│   │   ├── __init__.py
│   │   └── endpoints          # Endpoints for handling requests
│   │       ├── __init__.py
│   │       ├── patients.py    # Logic for patient information retrieval
│   │       └── fhir.py        # Interaction with FHIR server
│   ├── core                   # Core configuration and settings
│   │   ├── __init__.py
│   │   └── config.py          # Configuration settings
│   ├── models                 # Data models for the application
│   │   ├── __init__.py
│   │   └── patient.py         # Patient data model
│   └── services               # Services for business logic
│       ├── __init__.py
│       └── fhir_service.py    # Logic for FHIR API interaction
├── tests                      # Unit tests for the application
│   ├── __init__.py
│   └── test_api.py           # Tests for API endpoints
├── requirements.txt           # Project dependencies
├── .env.example               # Example environment variables
└── README.md                  # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd mediconnect
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Configure environment variables by copying `.env.example` to `.env` and filling in the necessary values.

5. Run the application:
   ```
   uvicorn app.main:app --reload
   ```

## Usage

Once the application is running, you can access the API documentation at `http://localhost:8000/docs`. Use the provided endpoints to authenticate and retrieve patient information.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.