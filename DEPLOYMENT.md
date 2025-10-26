# MediConnect Production Deployment Guide

## Deployment Architecture

**Two Separate Vercel Deployments:**
1. **Frontend**: Next.js app (from `mediconnect/` directory)
2. **Backend**: FastAPI Python API (from `server_end/` directory)

This separation provides better performance, independent scaling, and clearer separation of concerns.

## Pre-Deployment Checklist

### 1. Generate Secure Keys

Run these commands to generate secure keys:

```bash
# Generate AES_KEY
python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"

# Generate JWT_SECRET_KEY
python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"

# Generate SESSION_SECRET_KEY
python -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
```

Save these values - you'll need them for Vercel environment variables.

## Step-by-Step Deployment

### Step 1: Deploy Backend (FastAPI)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Navigate to backend directory**:
   ```bash
   cd server_end
   ```

4. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

5. **Set Environment Variables** in Vercel Dashboard or CLI:
   ```bash
   vercel env add MONGO_URI
   vercel env add AES_KEY
   vercel env add JWT_SECRET_KEY
   vercel env add SESSION_SECRET_KEY
   vercel env add FHIR_SERVER_URL
   vercel env add CLIENT_ID
   vercel env add CLIENT_SECRET
   vercel env add REDIRECT_URI
   vercel env add CORS_ORIGINS
   vercel env add FHIR_SCOPES
   vercel env add APP_NAME
   vercel env add APP_VERSION
   vercel env add DEBUG
   ```

   Or set them in the Vercel Dashboard:
   - Go to your project → Settings → Environment Variables
   - Add each variable from the list below

6. **Note your backend URL**: e.g., `https://mediconnect-api.vercel.app`

### Step 2: Update Epic Redirect URI

1. Go to Epic's FHIR App Management console
2. Update your app's redirect URI to: `https://your-backend-url.vercel.app/callback`
3. Save changes

### Step 3: Deploy Frontend (Next.js)

1. **Navigate to frontend directory**:
   ```bash
   cd ../mediconnect
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

3. **Set Environment Variable**:
   ```bash
   vercel env add NEXT_PUBLIC_API_BASE
   ```
   Value: `https://your-backend-url.vercel.app` (from Step 1)

4. **Note your frontend URL**: e.g., `https://mediconnect.vercel.app`

### Step 4: Update Backend Environment Variables

Now that you have both URLs, update the backend environment variables:

1. Go to your **backend** project in Vercel Dashboard
2. Update these environment variables:
   - `REDIRECT_URI` = `https://your-backend-url.vercel.app/callback`
   - `CORS_ORIGINS` = `https://your-frontend-url.vercel.app`

3. Redeploy backend:
   ```bash
   cd ../server_end
   vercel --prod
   ```

## Environment Variables Reference

### Backend Variables (server_end project in Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/mediconnect` |
| `AES_KEY` | 32-byte base64 encryption key | Generated in Step 1 |
| `JWT_SECRET_KEY` | JWT signing secret | Generated in Step 1 |
| `SESSION_SECRET_KEY` | Session encryption secret | Generated in Step 1 |
| `FHIR_SERVER_URL` | Epic FHIR server | `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4` |
| `CLIENT_ID` | Epic app client ID | From Epic developer portal |
| `CLIENT_SECRET` | Epic app client secret | From Epic developer portal |
| `REDIRECT_URI` | OAuth callback URL | `https://your-backend-url.vercel.app/callback` |
| `CORS_ORIGINS` | Allowed origins | `https://your-frontend-url.vercel.app` |
| `FHIR_SCOPES` | FHIR scopes | `patient/Patient.r patient/AllergyIntolerance.r patient/Condition.r patient/Observation.r patient/MedicationRequest.r patient/Immunization.r patient/DocumentReference.r launch/patient openid fhirUser` |
| `APP_NAME` | Application name | `MediConnect` |
| `APP_VERSION` | Version | `1.0.0` |
| `DEBUG` | Debug mode | `False` |

### Frontend Variables (mediconnect project in Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE` | Backend API URL | `https://your-backend-url.vercel.app` |

## Post-Deployment Testing

1. **Visit your frontend URL**: `https://your-frontend-url.vercel.app`

2. **Test EMT Registration**:
   - Click "Register as EMT"
   - Create test account
   - Verify success

3. **Test EMT Login**:
   - Login with EMT credentials
   - Should redirect to patient login page

4. **Test Patient Registration**:
   - Register a test patient
   - Try both password and fingerprint auth

5. **Test FHIR Integration**:
   - Login as patient
   - Click "Connect to Hospital Portal"
   - Should redirect to Epic's test authorization page
   - Use Epic test credentials
   - Verify data fetching works

6. **Check API Health**:
   - Visit `https://your-backend-url.vercel.app/docs`
   - Verify Swagger UI loads
   - Test endpoints

## Troubleshooting

### CORS Errors
**Symptom**: Frontend can't connect to backend, CORS errors in browser console

**Solutions**:
- Verify `CORS_ORIGINS` in backend includes your exact frontend URL
- Ensure no trailing slash in URLs
- Check that frontend is using correct `NEXT_PUBLIC_API_BASE`
- Redeploy backend after updating CORS_ORIGINS

### Epic OAuth Fails
**Symptom**: OAuth redirect fails or returns error

**Solutions**:
- Verify `REDIRECT_URI` matches Epic app configuration exactly
- Ensure Epic app redirect URI is `https://your-backend-url.vercel.app/callback`
- Check `CLIENT_ID` and `CLIENT_SECRET` are correct
- Verify patient exists in Epic sandbox
- Check FHIR scopes are approved in Epic app

### API Not Responding
**Symptom**: 500 errors or timeouts

**Solutions**:
- Check Vercel function logs (Project → Deployments → Click deployment → View Function Logs)
- Verify all environment variables are set correctly
- Test MongoDB connection (check IP whitelist in MongoDB Atlas)
- Check Python dependencies in `requirements.txt`

### Database Connection Errors
**Symptom**: MongoDB connection failures

**Solutions**:
- Verify `MONGO_URI` is correct
- Check MongoDB Atlas IP whitelist (allow all: `0.0.0.0/0`)
- Verify database name is `mediconnect`
- Check username/password in connection string
- Ensure network access is enabled

### Environment Variables Not Loading
**Symptom**: App uses default/localhost values

**Solutions**:
- Verify variables are set in correct project (frontend vs backend)
- Redeploy after setting environment variables
- Check variable names match exactly (case-sensitive)
- For frontend, ensure variables start with `NEXT_PUBLIC_`

## Security Verification Checklist

After deployment, verify:

- ✅ HTTPS is enforced (no HTTP access)
- ✅ Security headers are present (check browser dev tools → Network → Response Headers)
- ✅ CORS only allows your frontend domain
- ✅ API requires authentication (test without Bearer token)
- ✅ Sensitive data is encrypted in MongoDB
- ✅ No secrets in client-side code
- ✅ Epic OAuth works correctly
- ✅ JWT tokens expire (test with old token)

## Monitoring & Maintenance

### Vercel Monitoring
- Enable Vercel Analytics for frontend
- Monitor function execution times
- Check error rates in dashboard

### Application Monitoring
- Review Vercel function logs regularly
- Monitor MongoDB performance
- Track API response times
- Set up alerts for errors

### Regular Maintenance
- Rotate secrets periodically
- Update dependencies monthly
- Monitor Epic API changes
- Review access logs

## Scaling Considerations

For production scale, consider:

1. **Redis Integration**: Replace in-memory `token_store` with Redis
2. **Rate Limiting**: Add rate limiting middleware
3. **Database Indexing**: Add indexes to MongoDB collections
4. **Caching**: Implement response caching for FHIR data
5. **Monitoring**: Integrate Sentry or similar error tracking
6. **Load Testing**: Test with expected user load
7. **Backup Strategy**: Set up automated MongoDB backups

## Cost Estimation (Vercel)

- **Free Tier**: Good for demo/testing
  - Frontend: Unlimited bandwidth
  - Backend: 100GB-hrs serverless function execution

- **Pro Tier** ($20/month): Recommended for production
  - Increased limits
  - Better performance
  - Priority support

## Alternative Deployment Options

If you prefer not to use Vercel:

### Railway.app
- Use `railway.json` (already configured)
- Single deployment for both frontend and backend
- Built-in PostgreSQL/Redis if needed

### Render.com
- Use `render.yaml` (already configured)
- Separate services for frontend/backend
- Persistent storage options

### AWS/GCP/Azure
- Deploy frontend to S3/CloudFront or equivalent
- Deploy backend to Lambda/Cloud Functions or containerized
- More complex but maximum control

## Support

If you encounter issues:
1. Check Vercel function logs
2. Review browser console errors
3. Verify all environment variables
4. Test API endpoints directly via `/docs`
5. Check Epic's FHIR documentation

## Important Reminders

⚠️ **This is a SANDBOX deployment** - Uses Epic's test environment only

⚠️ **Update URLs after deployment** - Remember to update Epic redirect URI and CORS origins

⚠️ **Environment variables are critical** - Double-check all are set correctly

✅ **Your app is production-ready** - All security measures are in place for a demo deployment

