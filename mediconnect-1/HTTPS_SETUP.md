# Running MediConnect Backend with HTTPS

Epic FHIR requires HTTPS for OAuth redirect URIs, even in development. This guide shows you how to run the backend with HTTPS using self-signed certificates.

## Quick Start

### Step 1: Install cryptography package
```bash
# Make sure your virtual environment is activated
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Mac/Linux

pip install cryptography
```

### Step 2: Update your Epic FHIR App
1. Go to https://fhir.epic.com/
2. Edit your MediConnect app
3. Update the **Redirect URI** to: `https://localhost:8000/callback`
4. Save the changes

### Step 3: Run the HTTPS server
```bash
python start_https.py
```

This script will:
- ✅ Check for SSL certificates
- ✅ Generate them automatically if needed
- ✅ Start the server with HTTPS on `https://localhost:8000`

## Manual Certificate Generation

If you prefer to generate certificates manually:

```bash
python generate_cert.py
```

Then start the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
```

## Browser Security Warning

When you first visit `https://localhost:8000`, your browser will show a security warning because the certificate is self-signed. This is **normal and expected** for local development.

### How to Proceed:

**Chrome/Edge:**
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)"

**Firefox:**
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

**Safari:**
1. Click "Show Details"
2. Click "visit this website"
3. Enter your password if prompted

## Testing the Setup

1. **Start the backend (HTTPS):**
   ```bash
   python start_https.py
   ```

2. **Visit the API docs:**
   Open `https://localhost:8000/docs` in your browser
   - Accept the security warning
   - You should see the FastAPI Swagger UI

3. **Start the frontend:**
   ```bash
   cd ../mediconnect
   npm run dev
   ```

4. **Test OAuth flow:**
   - Go to `http://localhost:3000/fhir-access`
   - Click "Login with EHR System"
   - You should be redirected to Epic's login page without errors

## Troubleshooting

### Error: "Module 'cryptography' not found"
```bash
pip install cryptography
```

### Error: "Certificate files not found"
```bash
python generate_cert.py
```

### Error: "Address already in use"
```bash
# Stop any running uvicorn processes
# Windows PowerShell:
Get-Process -Name "python" | Where-Object {$_.Path -like "*uvicorn*"} | Stop-Process

# Or change the port in .env and start_https.py
```

### Frontend can't connect to backend
Make sure CORS is configured correctly in `.env`:
```
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://localhost:3000
```

## Production Deployment

⚠️ **IMPORTANT**: These self-signed certificates are for **development only**.

For production:
- Use a real domain name (not localhost)
- Get proper SSL certificates from Let's Encrypt or your hosting provider
- Configure your web server (nginx, Apache) to handle SSL
- Or use a cloud platform (AWS, Azure, GCP) that provides SSL

## Certificate Details

- **Validity**: 365 days from generation
- **Algorithm**: RSA 2048-bit with SHA-256
- **Subject Alternative Names**: localhost, 127.0.0.1
- **Location**: `certs/cert.pem` and `certs/key.pem`

## Security Notes

- 🔒 Certificates are self-signed (not trusted by browsers by default)
- 🏠 Only works for localhost/127.0.0.1
- ⏰ Valid for 1 year (regenerate after expiration)
- 🔐 Private key has no password (development only)
- ⚠️ Never use these certificates in production
- 📝 The `certs/` directory is git-ignored (keep it that way)

## Alternative: Using ngrok

If you can't get HTTPS working locally, you can use ngrok to create a public HTTPS URL:

```bash
# Install ngrok: https://ngrok.com/download

# Start your backend (HTTP is fine)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# In another terminal, start ngrok
ngrok http 8000
```

Then:
1. Copy the `https://` URL from ngrok (e.g., `https://abc123.ngrok.io`)
2. Update your Epic app redirect URI to: `https://abc123.ngrok.io/callback`
3. Update `REDIRECT_URI` in `.env` to match

**Note**: ngrok URLs change each time you restart, so you'll need to update Epic app registration each time.
