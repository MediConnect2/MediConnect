#!/bin/bash

# MediConnect HTTPS Configuration Verification Script
# Checks that everything is properly configured for HTTPS

echo "🔍 MediConnect HTTPS Configuration Checker"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

check_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "📁 Checking Directory Structure"
echo "--------------------------------"

if [ -d "server_end" ]; then
    check_pass "server_end/ directory exists"
else
    check_fail "server_end/ directory not found"
fi

if [ -d "mediconnect" ]; then
    check_pass "mediconnect/ directory exists"
else
    check_fail "mediconnect/ directory not found"
fi

echo ""
echo "🔐 Checking SSL Certificates"
echo "----------------------------"

if [ -f "server_end/certs/cert.pem" ]; then
    check_pass "SSL certificate found (cert.pem)"
    
    # Check expiration
    if command -v openssl &> /dev/null; then
        EXPIRY=$(openssl x509 -enddate -noout -in server_end/certs/cert.pem 2>/dev/null | cut -d= -f2)
        if [ -n "$EXPIRY" ]; then
            check_info "Certificate expires: $EXPIRY"
        fi
    fi
else
    check_fail "SSL certificate not found (server_end/certs/cert.pem)"
    check_info "Run: cd server_end && python generate_cert.py"
fi

if [ -f "server_end/certs/key.pem" ]; then
    check_pass "SSL private key found (key.pem)"
else
    check_fail "SSL private key not found (server_end/certs/key.pem)"
fi

echo ""
echo "⚙️  Checking Backend Configuration"
echo "----------------------------------"

if [ -f "server_end/.env" ]; then
    check_pass "Backend .env file exists"
    
    # Check HTTPS redirect URI
    if grep -q "REDIRECT_URI=https://localhost:8000" server_end/.env; then
        check_pass "REDIRECT_URI uses HTTPS ✅"
    else
        if grep -q "REDIRECT_URI=http://localhost:8000" server_end/.env; then
            check_fail "REDIRECT_URI uses HTTP (should be HTTPS)"
            check_info "Fix: Change to REDIRECT_URI=https://localhost:8000/fhir-callback"
        else
            check_warn "REDIRECT_URI not found or has different value"
        fi
    fi
    
    # Check required environment variables
    for VAR in "AES_KEY" "JWT_SECRET_KEY" "CLIENT_ID" "FHIR_SERVER_URL"; do
        if grep -q "^${VAR}=" server_end/.env; then
            check_pass "$VAR is set"
        else
            check_fail "$VAR is missing from .env"
        fi
    done
    
else
    check_fail "Backend .env file not found"
fi

echo ""
echo "🎨 Checking Frontend Configuration"
echo "-----------------------------------"

if [ -f "mediconnect/.env.local" ]; then
    check_pass "Frontend .env.local file exists"
    
    # Check HTTPS API base
    if grep -q "NEXT_PUBLIC_API_BASE=https://localhost:8000" mediconnect/.env.local; then
        check_pass "NEXT_PUBLIC_API_BASE uses HTTPS ✅"
    else
        if grep -q "NEXT_PUBLIC_API_BASE=http://localhost:8000" mediconnect/.env.local; then
            check_fail "NEXT_PUBLIC_API_BASE uses HTTP (should be HTTPS)"
            check_info "Fix: Change to NEXT_PUBLIC_API_BASE=https://localhost:8000"
        else
            check_warn "NEXT_PUBLIC_API_BASE not found or has different value"
        fi
    fi
    
else
    check_warn "Frontend .env.local file not found"
    check_info "Creating .env.local with HTTPS configuration..."
    echo "NEXT_PUBLIC_API_BASE=https://localhost:8000" > mediconnect/.env.local
    check_pass "Created mediconnect/.env.local"
fi

echo ""
echo "📝 Checking Frontend Pages"
echo "--------------------------"

# Check if pages use API_BASE variable
PAGES=(
    "mediconnect/src/app/patient-register/page.tsx"
    "mediconnect/src/app/fhir-callback/page.tsx"
    "mediconnect/src/app/hospital-login/page.tsx"
    "mediconnect/src/app/patient-login/page.tsx"
)

for PAGE in "${PAGES[@]}"; do
    PAGE_NAME=$(basename $(dirname "$PAGE"))
    if [ -f "$PAGE" ]; then
        if grep -q "const API_BASE = process.env.NEXT_PUBLIC_API_BASE" "$PAGE"; then
            check_pass "$PAGE_NAME uses API_BASE variable"
        else
            check_warn "$PAGE_NAME may not use API_BASE variable"
        fi
        
        # Check for hardcoded http:// URLs
        if grep -q "http://localhost:8000" "$PAGE"; then
            check_fail "$PAGE_NAME contains hardcoded HTTP URLs"
            check_info "Replace with: \${API_BASE}"
        fi
    else
        check_warn "$PAGE_NAME not found"
    fi
done

echo ""
echo "🚀 Checking Running Services"
echo "----------------------------"

# Check if HTTPS backend is running
if curl -k -s https://localhost:8000/docs > /dev/null 2>&1; then
    check_pass "Backend is running on HTTPS (port 8000)"
else
    check_warn "Backend not responding on HTTPS port 8000"
    check_info "Start with: cd server_end && uvicorn main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem"
fi

# Check if HTTP backend is running (should NOT be)
if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
    check_fail "Backend is running on HTTP (should only be HTTPS!)"
    check_info "Kill HTTP server: pkill -f 'uvicorn main:app'"
fi

# Check if frontend is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    check_pass "Frontend is running (port 3000)"
else
    check_warn "Frontend not responding on port 3000"
    check_info "Start with: cd mediconnect && npm run dev"
fi

# Check for multiple uvicorn processes
UVICORN_COUNT=$(pgrep -f "uvicorn main:app" | wc -l | tr -d ' ')
if [ "$UVICORN_COUNT" -eq "0" ]; then
    check_warn "No uvicorn processes running"
elif [ "$UVICORN_COUNT" -eq "1" ]; then
    check_pass "One uvicorn process running (correct)"
else
    check_fail "Multiple uvicorn processes running ($UVICORN_COUNT)"
    check_info "Kill all and restart: pkill -f 'uvicorn main:app' && ./start-https.sh"
fi

echo ""
echo "=========================================="
echo "📊 Summary"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Perfect! All checks passed.${NC}"
    echo "   Your MediConnect setup is ready for HTTPS."
    echo ""
    echo "🚀 Quick Start:"
    echo "   ./start-https.sh"
    echo ""
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration OK with $WARNINGS warning(s).${NC}"
    echo "   Review warnings above and fix if needed."
    echo ""
else
    echo -e "${RED}❌ Found $ERRORS error(s) and $WARNINGS warning(s).${NC}"
    echo "   Please fix the errors above before starting."
    echo ""
fi

echo "📚 Documentation:"
echo "   - Full setup: HTTPS_SECURITY_SETUP.md"
echo "   - Migration guide: HTTP_TO_HTTPS_MIGRATION.md"
echo "   - FHIR integration: HTTPS_FHIR_INTEGRATION_FIX.md"
echo ""
echo "🧪 Testing:"
echo "   1. Clear cache: http://localhost:3000/clear-cache.html"
echo "   2. Hospital login: http://localhost:3000/hospital-login"
echo "   3. Patient register: http://localhost:3000/patient-register"
echo ""

exit $ERRORS
