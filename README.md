# MediConnect

**Emergency access to the medical records that matter — for the people who need them in seconds.**

MediConnect is a full-stack healthcare platform that gives EMTs, hospitals, and patients a shared, secure channel to critical medical information. Patients link their real electronic health records through **Epic's SMART on FHIR API** (or enter them manually), and first responders can retrieve life-saving details — allergies, medications, conditions, blood type, emergency contacts — at the point of care using nothing more than a patient's name and driver's license ID.

---

## The Idea

In an emergency, the person treating you usually knows nothing about you. Your allergies, your medications, your conditions — all of it lives behind hospital portals you can't open from the back of an ambulance. MediConnect closes that gap:

1. **Patients** register once, then connect their healthcare provider through Epic's patient portal (MyChart) OAuth flow. Their FHIR medical record is pulled and stored encrypted, alongside any manually entered health data.
2. **EMTs** authenticate with their own credentials, then look up a patient using identifiers available at the scene — name + driver's license, the patient's MediConnect username, or fingerprint data — and immediately see the patient's medical summary.
3. **Hospitals** have their own authenticated access for verifying patient records during handoff and admission.

Every piece of personally identifiable and medical information is encrypted at rest with AES-256-GCM; passwords and fingerprints are bcrypt-hashed; and all sessions are governed by role-scoped JWTs.

---

## Repository Layout

This is a monorepo with three top-level pieces:

```
MediConnect/
├── mediconnect/          # Frontend — Next.js 15 (App Router), React 19, TypeScript
│   └── src/app/          # All routes/pages and shared components
├── server_end/           # Backend — FastAPI (Python), MongoDB, Epic FHIR integration
│   ├── main.py           # All API endpoints (auth, patients, EMTs, hospitals, FHIR)
│   ├── fhir_oauth.py     # SMART on FHIR OAuth2 + PKCE flow against Epic
│   ├── fhir_service.py   # FHIR R4 resource fetching (Patient, Allergies, Meds, …)
│   ├── db.py             # Async MongoDB client (Motor) and collections
│   ├── utils/encryption.py  # AES-256-GCM field-level encryption helpers
│   └── start_https.py    # Local HTTPS dev server (self-signed certs)
├── api/                  # Vercel serverless entry point (re-exports the FastAPI app)
└── vercel.json           # Vercel deployment config
```

---

## Architecture

```
                ┌─────────────────────────────────────────────┐
                │            Next.js Frontend (:3000)         │
                │  EMT login · Patient register/login/dash    │
                │  Hospital login · FHIR OAuth callback page  │
                └──────────────────────┬──────────────────────┘
                                       │ REST (JSON) + JWT Bearer
                ┌──────────────────────▼──────────────────────┐
                │           FastAPI Backend (:8000)           │
                │                                             │
                │  Auth (bcrypt + JWT, roles: patient/emt/    │
                │  hospital)   ·   AES-256-GCM field crypto   │
                │  FHIR OAuth handler (PKCE)  ·  FHIR service │
                └──────────┬───────────────────────┬──────────┘
                           │                       │ OAuth2 + FHIR R4
                ┌──────────▼──────────┐   ┌────────▼─────────────────┐
                │   MongoDB (Motor)   │   │   Epic FHIR Sandbox      │
                │  patients           │   │  MyChart patient login   │
                │  emt_users          │   │  Patient, Allergy, Meds, │
                │  hospitals          │   │  Conditions, Obs, Proc,  │
                └─────────────────────┘   │  Immunizations (R4)      │
                                          └──────────────────────────┘
```

### Frontend (`mediconnect/`)

Next.js 15 with the App Router, React 19, TypeScript, and Tailwind CSS 4. Every page is a client component that talks to the backend REST API (base URL from `NEXT_PUBLIC_API_BASE`, defaulting to `https://localhost:8000`).

| Route | Purpose |
|---|---|
| `/` | EMT login (the landing page — first responders are the primary consumer) |
| `/emt-register` | EMT account creation |
| `/patient-register` | Patient sign-up, including optional fingerprint enrollment |
| `/patient-login` | Multi-method patient lookup (username/password, name + driver's license, fingerprint) |
| `/patient-dashboard` | Patient's own view: profile, FHIR + manual medical data, tabbed summary |
| `/complete-profile` | Post-registration profile completion (contact, insurance, manual health data) |
| `/patient-access` | Credential-verified access to a patient record, plus account deletion |
| `/fhir-access` | Viewer for live FHIR data pulled from Epic (demographics, allergies, meds, vitals, …) |
| `/callback` | OAuth redirect target — finishes the Epic FHIR link and calls `/patient/link-fhir` |
| `/hospital-login` | Hospital staff authentication |

Auth state (JWTs, usernames) is kept in `localStorage`; a shared `Navbar` component listens for login-status events to update across pages. Security headers (HSTS, X-Frame-Options, nosniff, referrer policy, permissions policy) are set globally in [next.config.ts](mediconnect/next.config.ts).

### Backend (`server_end/`)

A single FastAPI application ([main.py](server_end/main.py)) exposing everything over REST, backed by MongoDB via the async Motor driver.

**Core endpoint groups:**

| Group | Endpoints |
|---|---|
| EMT auth | `POST /emt/register`, `POST /emt/login`, `GET /verify-emt-token` |
| Patient auth | `POST /register`, `POST /patient/login`, `POST /patient/delete`, `POST /check-patient-access`, `GET /verify-patient-token` |
| Patient profile | `POST /patient/update-profile`, `GET /patient/profile/{username}` |
| Hospital auth | `POST /hospital/login`, `GET /verify-hospital-token` |
| FHIR OAuth | `POST /fhir-login`, `GET /login`, `GET /callback`, `POST /fhir-logout` |
| FHIR data | `POST /fhir-request` (all resources), `POST /fhir-resource` (single type), `POST /patient/link-fhir`, `POST /patient/skip-fhir` |

**Patient login supports three credential paths**, designed around what's actually available in an emergency:

1. MediConnect username + password
2. First name + last name + driver's license ID (matched against decrypted records)
3. Fingerprint data (bcrypt-verified against enrolled hash)

All three return a role-scoped JWT plus a patient summary that includes FHIR connection status and counts of allergies, conditions, medications, observations, procedures, and immunizations (merging FHIR entries with manually entered items).

### Epic FHIR Integration

The standout piece of the backend is a full **SMART on FHIR** patient-facing OAuth2 flow against Epic ([fhir_oauth.py](server_end/fhir_oauth.py), [fhir_service.py](server_end/fhir_service.py)):

1. `POST /fhir-login` generates a session ID, a PKCE verifier/challenge pair, and a CSRF `state` token, then returns Epic's authorization URL.
2. The patient authenticates in Epic's MyChart portal and Epic redirects to `GET /callback` with an authorization code.
3. The backend validates `state`, exchanges the code (with the PKCE verifier) for an access token, and redirects to the frontend's `/callback` page.
4. The frontend calls `POST /patient/link-fhir`, which fetches the patient's comprehensive FHIR R4 record — demographics, `AllergyIntolerance`, `Condition`, `MedicationRequest`, `Observation` (vital signs / labs / social history), `Procedure`, `Immunization` — and stores it in the patient's MongoDB document.

Patients can also skip linking (`POST /patient/skip-fhir`) and rely on manually entered health data, which is stored encrypted and merged into the same medical summary. Epic sandbox quirks (e.g., 403s on restricted resources) are handled gracefully so partial data still comes back.

### Data Model (MongoDB, database `mediconnect`)

| Collection | Contents |
|---|---|
| `patients` | Credentials (bcrypt), encrypted PII (name, driver's license, contact, address, insurance, DOB, blood type), encrypted manual health data, FHIR link state (`fhir_connected`, `fhir_patient_id`, `fhir_data`, `provider_name`, `registration_status`), optional fingerprint hash |
| `emt_users` | Username, bcrypt password hash, encrypted name fields |
| `hospitals` | Username, bcrypt password hash, display name |

### Security Model

- **Field-level encryption** — every PII/PHI field is encrypted with AES-256-GCM using a per-value random 12-byte nonce ([utils/encryption.py](server_end/utils/encryption.py)); ciphertext and nonce are stored together, the key comes from the `AES_KEY` env var.
- **Password & fingerprint hashing** — bcrypt with per-hash salts; nothing reversible is stored.
- **JWT sessions** — HS256 tokens (30-minute expiry) carrying a `role` claim (`patient`/`emt`/`hospital`); FastAPI dependencies enforce role-appropriate access per endpoint.
- **OAuth hardening** — PKCE (S256) plus a random `state` parameter for CSRF protection on the Epic flow.
- **Transport** — local dev supports HTTPS with self-signed certs ([start_https.py](server_end/start_https.py)); CORS origins are restricted via the `CORS_ORIGINS` env var; the frontend ships strict security headers.
- **Guarded destructive actions** — account deletion requires username, password, driver's license ID, *and* typing the literal confirmation phrase `DELETE ACCOUNT`.

---

## Running Locally

### Backend

```bash
cd server_end
pip install -r requirements.txt

# .env (server_end/.env)
# MONGO_URI=mongodb+srv://...
# JWT_SECRET_KEY=<random secret>
# AES_KEY=<url-safe base64 of a 32-byte key>
# CORS_ORIGINS=http://localhost:3000
# CLIENT_ID=<Epic app client id>
# FHIR_SERVER_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
# REDIRECT_URI=https://localhost:8000/callback

# HTTP:
uvicorn main:app --reload --host localhost --port 8000
# or HTTPS with auto-generated self-signed certs:
python start_https.py
```

Interactive API docs are served at `http://localhost:8000/docs`. `python test_fhir.py` exercises the FHIR integration, and [QUICK_START.md](server_end/QUICK_START.md) walks through the full OAuth flow step by step.

### Frontend

```bash
cd mediconnect
npm install

# .env.local
# NEXT_PUBLIC_API_BASE=https://localhost:8000

npm run dev   # Next.js dev server with Turbopack → http://localhost:3000
```

---

## Deployment

The repo carries configuration for several targets:

- **Vercel** — root [vercel.json](vercel.json) plus [api/index.py](api/index.py), which re-exports the FastAPI app as a serverless function; the frontend has its own [vercel.json](mediconnect/vercel.json) and builds with `output: 'standalone'`.
- **Railway** — [railway.json](server_end/railway.json) (Nixpacks build, on-failure restarts) with the [Procfile](server_end/Procfile) start command.
- **Render** — [render.yaml](server_end/render.yaml) defines the backend web service and its required environment variables.

### Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGO_URI` | backend | MongoDB connection string |
| `JWT_SECRET_KEY` | backend | HS256 signing key for session tokens |
| `AES_KEY` | backend | Base64-encoded 256-bit key for field encryption |
| `CORS_ORIGINS` | backend | Comma-separated allowed frontend origins |
| `CLIENT_ID` / `CLIENT_SECRET` | backend | Epic FHIR app credentials |
| `FHIR_SERVER_URL` | backend | Epic FHIR R4 base URL |
| `REDIRECT_URI` | backend | OAuth callback URL registered with Epic |
| `FHIR_SCOPES` | backend | SMART on FHIR scopes requested at authorization |
| `NEXT_PUBLIC_API_BASE` | frontend | Backend API base URL |

---

## Tech Stack at a Glance

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, styled-components |
| Backend | FastAPI, Pydantic, Uvicorn |
| Database | MongoDB (async via Motor) |
| Health data | Epic SMART on FHIR (R4), OAuth2 + PKCE, httpx |
| Security | bcrypt, AES-256-GCM (`cryptography`), JWT (`python-jose`) |
| Deployment | Vercel (frontend + serverless API), Railway / Render (backend) |

## License

See [LICENSE](LICENSE).
