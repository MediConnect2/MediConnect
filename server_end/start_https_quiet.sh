#!/bin/bash

# Start MediConnect Backend with HTTPS (Suppress Invalid HTTP Warnings)

cd "$(dirname "$0")"

echo "🚀 Starting MediConnect Backend with HTTPS"
echo "📍 URL: https://localhost:8000"
echo "📚 API Docs: https://localhost:8000/docs"
echo ""
echo "⚠️  Note: Invalid HTTP request warnings are suppressed (normal for HTTPS server)"
echo ""

# Start with log level WARNING to suppress INFO-level invalid HTTP warnings
uvicorn main:app --reload --host 0.0.0.0 --port 8000 \
    --ssl-keyfile certs/key.pem \
    --ssl-certfile certs/cert.pem \
    --log-level warning
