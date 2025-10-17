# Production Deployment Guide for MediConnect FHIR Integration

## ⚠️ CRITICAL WARNING
This application handles Protected Health Information (PHI). Do NOT deploy to production without completing ALL items in this checklist.

## Quick Reference: Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| HTTP/HTTPS | HTTP (localhost) | HTTPS only (TLS 1.3) |
| FHIR Server | Sandbox | Production EHR |
| Session Storage | In-memory | Redis/Database |
| Logging | Console | Structured + Audit logs |
| Error Tracking | None | Sentry/DataDog |
| Rate Limiting | None | Implemented |
| Monitoring | None | 24/7 monitoring |
| Backups | None | Automated daily |
| HIPAA Compliance | Not required | Fully compliant |

## Step 1: Legal & Compliance (BEFORE Technical Work)

### 1.1 Business Associate Agreements (BAAs)
Sign BAAs with:
- [ ] Cloud hosting provider (AWS/Azure/GCP)
- [ ] Database provider
- [ ] Logging service provider
- [ ] Error tracking service
- [ ] EHR vendor (Epic/Cerner/etc.)
- [ ] Any service handling PHI

### 1.2 Legal Documents
Create and publish:
- [ ] Privacy Policy
- [ ] Terms of Service
- [ ] HIPAA Notice of Privacy Practices
- [ ] User consent forms
- [ ] Data retention policy (7 years typical)
- [ ] Data breach notification procedures

### 1.3 Insurance
Obtain:
- [ ] Cyber liability insurance ($1M+ recommended)
- [ ] Professional liability insurance
- [ ] General liability insurance

### 1.4 HIPAA Compliance
- [ ] Risk assessment completed
- [ ] Security policies documented
- [ ] Employee training program established
- [ ] Incident response plan created
- [ ] Physical security measures documented

## Step 2: Infrastructure Setup

### 2.1 SSL/TLS Configuration
```nginx
# Nginx configuration example
server {
    listen 443 ssl http2;
    server_name api.mediconnect.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2.2 Database Setup
```sql
-- PostgreSQL production setup
CREATE DATABASE mediconnect_prod;

-- Create audit log table
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN,
    error_message TEXT
);

CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_resource ON audit_log(resource_id);

-- Enable row-level security
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
```

### 2.3 Redis Setup
```bash
# Redis configuration for session storage
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET requirepass "strong-redis-password"
```

## Step 3: Code Changes for Production

### 3.1 Update config.py
```python
from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Environment
    environment: str = "production"
    debug: bool = False
    
    # FHIR Configuration
    fhir_server_url: str
    client_id: str
    client_secret: str
    redirect_uri: str
    
    # Security
    session_secret_key: str
    allowed_hosts: list = []
    cors_origins: list = []
    
    # Database
    database_url: str
    database_pool_size: int = 20
    
    # Redis
    redis_url: str
    redis_ttl: int = 3600
    
    # Monitoring
    sentry_dsn: Optional[str] = None
    
    # Rate Limiting
    rate_limit_per_minute: int = 60
    
    class Config:
        env_file = ".env.production"
        case_sensitive = False

settings = Settings()
```

### 3.2 Add Audit Logging
```python
# app/services/audit_service.py
from datetime import datetime
import asyncpg

class AuditService:
    def __init__(self, db_pool):
        self.db = db_pool
    
    async def log_access(
        self,
        user_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        ip_address: str,
        user_agent: str,
        success: bool,
        error_message: str = None
    ):
        """Log all access to PHI"""
        await self.db.execute("""
            INSERT INTO audit_log 
            (user_id, action, resource_type, resource_id, 
             ip_address, user_agent, success, error_message)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """, user_id, action, resource_type, resource_id,
            ip_address, user_agent, success, error_message)
```

### 3.3 Add Rate Limiting
```python
# app/middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"]
)

# In main.py
from slowapi import _rate_limit_exceeded_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/api/patient-info")
@limiter.limit("10/minute")
async def get_patient_info(request: Request):
    # ... existing code
```

### 3.4 Add Session with Redis
```python
# Install: pip install redis aioredis
from redis import asyncio as aioredis
import json

class RedisSessionBackend:
    def __init__(self, redis_url: str):
        self.redis = aioredis.from_url(redis_url)
    
    async def set_session(self, session_id: str, data: dict, ttl: int = 3600):
        await self.redis.setex(
            f"session:{session_id}",
            ttl,
            json.dumps(data)
        )
    
    async def get_session(self, session_id: str):
        data = await self.redis.get(f"session:{session_id}")
        return json.loads(data) if data else None
    
    async def delete_session(self, session_id: str):
        await self.redis.delete(f"session:{session_id}")
```

### 3.5 Add Error Tracking
```python
# Install: pip install sentry-sdk
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        environment=settings.environment,
        before_send=scrub_phi  # Remove PHI from error reports
    )

def scrub_phi(event, hint):
    """Remove PHI from error reports"""
    # Remove sensitive fields
    if 'request' in event:
        event['request']['cookies'] = '[Filtered]'
        event['request']['headers'] = '[Filtered]'
    return event
```

### 3.6 Enhanced Logging
```python
# app/core/logging.py
import logging
import json
from datetime import datetime

class StructuredLogger:
    def __init__(self):
        self.logger = logging.getLogger("mediconnect")
        handler = logging.FileHandler("mediconnect.log")
        handler.setFormatter(
            logging.Formatter('%(message)s')
        )
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
    
    def log_request(self, request, response, duration):
        """Log request without PHI"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "method": request.method,
            "path": request.url.path,  # NO query params
            "status_code": response.status_code,
            "duration_ms": duration * 1000,
            "ip": request.client.host,
            "user_agent": request.headers.get("user-agent", "")[:100]
        }
        self.logger.info(json.dumps(log_entry))
```

## Step 4: Production Environment Variables

Create `.env.production`:
```bash
# Environment
ENVIRONMENT=production
DEBUG=False

# FHIR Server (PRODUCTION!)
FHIR_SERVER_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
CLIENT_ID=prod_abc123xyz
CLIENT_SECRET=prod_secret_xyz789
REDIRECT_URI=https://api.mediconnect.com/callback

# Security
SESSION_SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(32))">
ALLOWED_HOSTS=api.mediconnect.com,www.mediconnect.com
CORS_ORIGINS=https://app.mediconnect.com,https://www.mediconnect.com

# Database
DATABASE_URL=postgresql://user:pass@prod-db.internal:5432/mediconnect
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://:password@prod-redis.internal:6379/0
REDIS_TTL=3600

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/yyy

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

## Step 5: Deployment

### 5.1 Docker Deployment
```dockerfile
# Dockerfile.production
FROM python:3.11-slim

# Security: Don't run as root
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run with Gunicorn
CMD ["gunicorn", "app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
```

### 5.2 Docker Compose
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/mediconnect
      - REDIS_URL=redis://:password@redis:6379/0
    depends_on:
      - db
      - redis
    restart: always
    
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: mediconnect
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass password
    volumes:
      - redis_data:/data
    restart: always
    
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: always

volumes:
  postgres_data:
  redis_data:
```

### 5.3 Kubernetes Deployment (if using K8s)
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mediconnect-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mediconnect-api
  template:
    metadata:
      labels:
        app: mediconnect-api
    spec:
      containers:
      - name: api
        image: mediconnect-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: mediconnect-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Step 6: Monitoring & Alerting

### 6.1 Health Check Endpoint
```python
@app.get("/health")
async def health_check():
    """Health check for load balancers"""
    try:
        # Check database
        await db.execute("SELECT 1")
        
        # Check Redis
        await redis.ping()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )
```

### 6.2 Prometheus Metrics
```python
# Install: pip install prometheus-fastapi-instrumentator
from prometheus_fastapi_instrumentator import Instrumentator

instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app)
```

### 6.3 Alerts to Configure
- Response time > 2 seconds
- Error rate > 5%
- Authentication failures > 10/min
- Database connection failures
- SSL certificate expiring (30 days)
- Disk space < 20%
- Memory usage > 80%

## Step 7: Backup & Disaster Recovery

### 7.1 Database Backups
```bash
# Daily automated backup
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump -h localhost -U user mediconnect | \
    gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Encrypt backup
gpg --encrypt --recipient backup@mediconnect.com \
    "$BACKUP_DIR/backup_$DATE.sql.gz"

# Upload to S3 with encryption
aws s3 cp "$BACKUP_DIR/backup_$DATE.sql.gz.gpg" \
    s3://mediconnect-backups/postgres/ \
    --server-side-encryption AES256

# Keep only last 30 days
find "$BACKUP_DIR" -name "backup_*.sql.gz*" -mtime +30 -delete
```

### 7.2 Disaster Recovery Plan
Document procedures for:
- Database restoration
- Service failover
- Data center outage
- Security breach response
- Contact information for emergencies

## Step 8: Security Hardening

### 8.1 Firewall Rules
```bash
# Only allow necessary ports
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH (restrict to specific IPs)
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 8.2 Security Headers
```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```

### 8.3 Secrets Management
Use AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault:
```python
import boto3

def get_secret(secret_name):
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# Usage
secrets = get_secret('mediconnect/production')
settings.client_secret = secrets['CLIENT_SECRET']
```

## Step 9: Testing in Production

### 9.1 Smoke Tests
```bash
# Test critical endpoints
curl -f https://api.mediconnect.com/health || exit 1
curl -f https://api.mediconnect.com/ || exit 1
```

### 9.2 Load Testing
```bash
# Using artillery
artillery quick \
    --count 1000 \
    --num 100 \
    https://api.mediconnect.com/health
```

### 9.3 Security Scanning
```bash
# OWASP ZAP
docker run -t owasp/zap2docker-stable \
    zap-baseline.py -t https://api.mediconnect.com
```

## Step 10: Go Live Checklist

### Pre-Launch
- [ ] All code reviewed
- [ ] Security audit passed
- [ ] Penetration test completed
- [ ] Load testing passed
- [ ] Backup system tested
- [ ] Monitoring configured
- [ ] Alerts tested
- [ ] SSL certificates valid
- [ ] DNS configured
- [ ] Firewall rules in place

### Legal & Compliance
- [ ] All BAAs signed
- [ ] HIPAA compliance verified
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Insurance obtained

### Operations
- [ ] Team trained
- [ ] On-call schedule established
- [ ] Incident response plan tested
- [ ] Communication plan ready
- [ ] Rollback plan documented

### Post-Launch
- [ ] Monitor metrics closely (first 24h)
- [ ] Check error rates
- [ ] Verify backups running
- [ ] Test all critical paths
- [ ] Collect user feedback

## Cost Estimates

### Monthly Production Costs (AWS example):
- EC2 instances (t3.medium x2): $60
- RDS PostgreSQL (db.t3.medium): $100
- ElastiCache Redis (cache.t3.small): $30
- Load Balancer: $20
- S3 storage (backups): $10
- CloudWatch: $10
- Sentry: $26
- Domain & SSL: $10
**Total: ~$266/month** (starting scale)

## Emergency Contacts Template

```
MEDICONNECT EMERGENCY CONTACTS

Production Issues:
- On-call engineer: [Phone]
- Backup engineer: [Phone]

Security Incidents:
- Security lead: [Phone]
- Legal: [Phone]
- PR/Communications: [Phone]

Service Providers:
- AWS Support: [Account ID]
- Epic Support: [Case URL]
- Database Admin: [Phone]

Escalation Path:
1. On-call engineer
2. Team lead
3. CTO
4. CEO (for major incidents)
```

---

## 🎉 You're Ready for Production!

After completing ALL items above, your MediConnect application will be:
- ✅ Secure
- ✅ HIPAA Compliant
- ✅ Scalable
- ✅ Monitored
- ✅ Backed up
- ✅ Production-ready

**Remember: Healthcare data is serious. When in doubt, consult with:**
- Healthcare IT compliance expert
- Security professional
- Healthcare attorney
- HIPAA consultant

Good luck! 🚀🏥
