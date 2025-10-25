# MediConnect Deployment Guide

## Overview
MediConnect requires deploying two separate applications:
1. **Frontend**: Next.js app (mediconnect folder)
2. **Backend**: FastAPI server (server_end folder)

Both require HTTPS in production for Epic FHIR OAuth to work.

---

## 🎯 Recommended Deployment Stack

### Frontend: Vercel
### Backend: Railway or Render

This combination provides:
- ✅ Free tiers available
- ✅ Automatic HTTPS certificates
- ✅ Easy deployment (Git-based)
- ✅ Good performance
- ✅ No need for manual SSL certificate management

---

## 📦 Frontend Deployment (Next.js on Vercel)

### Prerequisites
```bash
npm install -g vercel
```

### Steps

1. **Navigate to frontend folder**
   ```bash
   cd mediconnect
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Set Environment Variable**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_API_BASE` = `https://your-backend-url.railway.app`
   - Redeploy after setting

### Alternative: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**
   ```bash
   cd mediconnect
   netlify deploy --prod
   ```

3. **Set environment variable in Netlify dashboard**

---

## 🔧 Backend Deployment

### Option 1: Railway (Recommended)

#### Why Railway?
- Free tier: 500 hours/month
- Automatic HTTPS
- Zero-config Python deployment
- PostgreSQL/MongoDB add-ons available
- Environment variables built-in

#### Setup Files Needed

**Create `railway.json`** (I'll create this for you)

**Create `Procfile`**:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### Deployment Steps

1. **Sign up at [railway.app](https://railway.app)**

2. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

3. **Login**
   ```bash
   railway login
   ```

4. **Initialize project**
   ```bash
   cd server_end
   railway init
   ```

5. **Add environment variables**
   ```bash
   railway variables set REDIRECT_URI=https://your-backend-url.railway.app/fhir-callback
   railway variables set MONGO_URI=your-production-mongodb-uri
   railway variables set JWT_SECRET=your-secure-random-string
   railway variables set ENCRYPTION_KEY=your-32-byte-base64-key
   ```

6. **Deploy**
   ```bash
   railway up
   ```

7. **Get your URL**
   ```bash
   railway domain
   ```
   Copy this URL and use it in your frontend's `NEXT_PUBLIC_API_BASE`

---

### Option 2: Render

#### Setup Files Needed

**Create `render.yaml`** (I'll create this for you)

#### Deployment Steps

1. **Sign up at [render.com](https://render.com)**

2. **Create New Web Service**
   - Connect your GitHub repo
   - Select `server_end` as root directory
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Add environment variables** in Render dashboard

4. **Deploy** - Render will auto-deploy on Git push

---

### Option 3: AWS EC2 / DigitalOcean (Advanced)

#### When to use this?
- Need full control
- Want to use same server for frontend + backend
- Already familiar with server management

#### Setup

1. **Launch Ubuntu server**

2. **Install dependencies**
   ```bash
   sudo apt update
   sudo apt install python3-pip nginx certbot python3-certbot-nginx
   ```

3. **Clone your repo**
   ```bash
   git clone https://github.com/aadisaraf/MediConnect.git
   cd MediConnect/server_end
   pip3 install -r requirements.txt
   ```

4. **Setup SSL with Let's Encrypt**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

5. **Create systemd service** (replaces .sh script)
   ```bash
   sudo nano /etc/systemd/system/mediconnect.service
   ```
   
   ```ini
   [Unit]
   Description=MediConnect FastAPI
   After=network.target

   [Service]
   User=ubuntu
   WorkingDirectory=/home/ubuntu/MediConnect/server_end
   Environment="PATH=/home/ubuntu/.local/bin"
   ExecStart=/usr/local/bin/uvicorn main:app --host 0.0.0.0 --port 8000
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

6. **Start service**
   ```bash
   sudo systemctl start mediconnect
   sudo systemctl enable mediconnect
   ```

7. **Configure Nginx as reverse proxy**
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;
       
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       
       location / {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

---

## 🔐 Epic FHIR OAuth Configuration Update

### After deployment, update Epic app settings:

1. **Login to Epic Fhir Developer Portal**
   - https://fhir.epic.com/Developer/Apps

2. **Update Redirect URI**
   - Change from: `https://localhost:8000/fhir-callback`
   - Change to: `https://your-backend-url.railway.app/fhir-callback`

3. **Update Application Audience**
   - Keep as: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/`

4. **Save changes** - May take a few minutes to propagate

---

## 📊 Database Considerations

### MongoDB

**Development (Current):**
- Local MongoDB

**Production Options:**

1. **MongoDB Atlas** (Recommended)
   - Free tier: 512MB
   - Automatic backups
   - Global deployment
   - Sign up: https://www.mongodb.com/cloud/atlas
   - Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/mediconnect`

2. **Railway MongoDB Plugin**
   - Add to your Railway project
   - Automatic connection string injection

3. **Self-hosted**
   - On same EC2/DigitalOcean server
   - More maintenance required

---

## 🔑 Environment Variables Checklist

### Backend (server_end)
- `REDIRECT_URI` - HTTPS callback URL from your deployed backend
- `MONGO_URI` - Production MongoDB connection string
- `JWT_SECRET` - Random secure string (generate new for production)
- `ENCRYPTION_KEY` - 32-byte base64 key (generate new for production)
- `CLIENT_ID` - Epic FHIR app client ID
- `PORT` - Usually auto-set by platform (Railway/Render)

### Frontend (mediconnect)
- `NEXT_PUBLIC_API_BASE` - Your deployed backend URL

---

## 🧪 Testing Deployment

### 1. Test Backend Health
```bash
curl https://your-backend-url.railway.app/docs
```
Should return FastAPI Swagger docs

### 2. Test Frontend
Visit your Vercel URL, navigate to hospital login

### 3. Test FHIR OAuth
1. Go to patient registration
2. Click "Connect to FHIR"
3. Should redirect to Epic MyChart
4. After login, should callback to your production URL

---

## 🚨 Common Deployment Issues

### Issue: CORS errors
**Solution:** Update CORS settings in `server_end/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Development
        "https://your-frontend.vercel.app",  # Production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: Environment variables not loading
**Solution:** Restart the service after adding variables

### Issue: Epic OAuth redirect fails
**Solution:** 
1. Verify redirect URI in Epic app matches exactly
2. Check HTTPS is enabled
3. Ensure no trailing slashes

### Issue: Database connection fails
**Solution:** Check MongoDB Atlas IP whitelist (allow 0.0.0.0/0 for Railway/Render)

---

## 💰 Cost Estimate

### Free Tier (Good for MVP/Testing)
- **Vercel**: Free (Hobby plan)
- **Railway**: Free 500 hours/month
- **MongoDB Atlas**: Free 512MB
- **Total**: $0/month

### Paid Tier (Production-ready)
- **Vercel Pro**: $20/month
- **Railway**: ~$5-10/month (pay for usage)
- **MongoDB Atlas**: $9/month (M2 shared)
- **Total**: ~$35-40/month

### Self-hosted (EC2/DigitalOcean)
- **Server**: $5-10/month (1GB RAM)
- **Domain**: $10-15/year
- **Total**: ~$5-10/month

---

## 🔄 CI/CD (Optional)

### Automatic deployment on Git push

**For Railway:**
- Automatically enabled when you link GitHub repo

**For Render:**
- Automatically enabled when you link GitHub repo

**For EC2/DigitalOcean:**
Create GitHub Action (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to Server
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_IP }}
          username: ubuntu
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /home/ubuntu/MediConnect
            git pull
            cd server_end
            pip3 install -r requirements.txt
            sudo systemctl restart mediconnect
```

---

## ✅ Deployment Checklist

- [ ] Choose hosting platforms (Frontend + Backend)
- [ ] Update Epic FHIR app redirect URI
- [ ] Setup production MongoDB
- [ ] Generate new JWT_SECRET and ENCRYPTION_KEY for production
- [ ] Deploy backend first, get URL
- [ ] Set NEXT_PUBLIC_API_BASE in frontend
- [ ] Deploy frontend
- [ ] Update CORS origins in backend
- [ ] Test full OAuth flow
- [ ] Test patient registration
- [ ] Test hospital login
- [ ] Monitor logs for errors
- [ ] Setup error tracking (Sentry recommended)

---

## 📞 Next Steps

1. **Choose your stack** (I recommend Vercel + Railway)
2. **Create accounts** on chosen platforms
3. **Let me know your choice** - I'll create platform-specific config files
4. **Deploy backend** and get URL
5. **Update environment variables**
6. **Deploy frontend**
7. **Test everything**

Which platform combination would you like to use?
