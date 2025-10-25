"""
Start the MediConnect backend with HTTPS support.
This script checks for SSL certificates and generates them if needed.
"""
import os
import sys
import subprocess

def check_certificates():
    """Check if SSL certificates exist"""
    cert_path = "certs/cert.pem"
    key_path = "certs/key.pem"
    
    if os.path.exists(cert_path) and os.path.exists(key_path):
        print("✅ SSL certificates found")
        return True
    else:
        print("⚠️  SSL certificates not found")
        return False

def generate_certificates():
    """Generate SSL certificates"""
    print("🔧 Generating SSL certificates...")
    try:
        subprocess.run([sys.executable, "generate_cert.py"], check=True)
        return True
    except subprocess.CalledProcessError:
        print("❌ Failed to generate certificates")
        return False

def start_server():
    """Start the uvicorn server with HTTPS"""
    print("\n🚀 Starting MediConnect backend with HTTPS...")
    print("📍 URL: https://localhost:8000")
    print("📚 API Docs: https://localhost:8000/docs")
    print("\n⚠️  Your browser will show a security warning for self-signed certificate.")
    print("   Click 'Advanced' → 'Proceed to localhost' to continue.\n")
    
    try:
        subprocess.run([
            "uvicorn",
            "main:app",
            "--reload",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--ssl-keyfile", "certs/key.pem",
            "--ssl-certfile", "certs/cert.pem"
        ])
    except KeyboardInterrupt:
        print("\n👋 Server stopped")

if __name__ == "__main__":
    # Check for certificates
    if not check_certificates():
        if not generate_certificates():
            print("❌ Cannot start server without SSL certificates")
            sys.exit(1)
    
    # Start server
    start_server()
