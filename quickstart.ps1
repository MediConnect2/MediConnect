# MediConnect Quick Start Script (Windows PowerShell)
# This script helps set up the development environment

Write-Host "🏥 MediConnect FHIR Integration - Quick Start" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.9+" -ForegroundColor Red
    exit 1
}

# Check Node.js installation
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✓ Found Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Choose setup option:" -ForegroundColor Cyan
Write-Host "1. Setup FastAPI Backend" -ForegroundColor White
Write-Host "2. Setup Next.js Frontend" -ForegroundColor White
Write-Host "3. Setup Both (Recommended)" -ForegroundColor White
Write-Host "4. Start Servers" -ForegroundColor White
Write-Host "5. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-5)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Setting up FastAPI Backend..." -ForegroundColor Cyan
        Write-Host "==============================" -ForegroundColor Cyan
        
        Set-Location mediconnect-1
        
        # Create virtual environment
        Write-Host "Creating virtual environment..." -ForegroundColor Yellow
        python -m venv venv
        
        # Activate virtual environment
        Write-Host "Activating virtual environment..." -ForegroundColor Yellow
        .\venv\Scripts\Activate.ps1
        
        # Install dependencies
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        pip install -r requirements.txt
        
        # Check for .env file
        if (-Not (Test-Path .env)) {
            Write-Host ""
            Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
            Write-Host "Copying .env.example to .env..." -ForegroundColor Yellow
            Copy-Item .env.example .env
            Write-Host ""
            Write-Host "📝 Please edit .env file with your FHIR credentials:" -ForegroundColor Cyan
            Write-Host "   - CLIENT_ID" -ForegroundColor White
            Write-Host "   - CLIENT_SECRET" -ForegroundColor White
            Write-Host "   - FHIR_SERVER_URL" -ForegroundColor White
            Write-Host "   - SESSION_SECRET_KEY" -ForegroundColor White
        }
        
        Write-Host ""
        Write-Host "✅ FastAPI Backend setup complete!" -ForegroundColor Green
        Write-Host "   To start: cd mediconnect-1 && .\venv\Scripts\Activate.ps1 && uvicorn app.main:app --reload" -ForegroundColor White
    }
    
    "2" {
        Write-Host ""
        Write-Host "Setting up Next.js Frontend..." -ForegroundColor Cyan
        Write-Host "==============================" -ForegroundColor Cyan
        
        Set-Location mediconnect
        
        # Install dependencies
        Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
        npm install
        
        Write-Host ""
        Write-Host "✅ Next.js Frontend setup complete!" -ForegroundColor Green
        Write-Host "   To start: cd mediconnect && npm run dev" -ForegroundColor White
    }
    
    "3" {
        Write-Host ""
        Write-Host "Setting up Both Applications..." -ForegroundColor Cyan
        Write-Host "================================" -ForegroundColor Cyan
        
        # Setup Backend
        Write-Host ""
        Write-Host "1/2: Setting up FastAPI Backend..." -ForegroundColor Yellow
        Set-Location mediconnect-1
        python -m venv venv
        .\venv\Scripts\Activate.ps1
        pip install -r requirements.txt
        
        if (-Not (Test-Path .env)) {
            Copy-Item .env.example .env
            Write-Host "⚠️  .env file created. Please edit with your credentials!" -ForegroundColor Yellow
        }
        
        Set-Location ..
        
        # Setup Frontend
        Write-Host ""
        Write-Host "2/2: Setting up Next.js Frontend..." -ForegroundColor Yellow
        Set-Location mediconnect
        npm install
        Set-Location ..
        
        Write-Host ""
        Write-Host "✅ Both applications setup complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Edit mediconnect-1\.env with your FHIR credentials" -ForegroundColor White
        Write-Host "2. Run this script again and choose option 4 to start servers" -ForegroundColor White
    }
    
    "4" {
        Write-Host ""
        Write-Host "Starting Servers..." -ForegroundColor Cyan
        Write-Host "===================" -ForegroundColor Cyan
        
        # Check if .env exists
        if (-Not (Test-Path mediconnect-1\.env)) {
            Write-Host "⚠️  .env file not found in mediconnect-1!" -ForegroundColor Red
            Write-Host "Please run setup first (option 1 or 3)" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "🚀 Starting FastAPI Backend (Terminal 1)..." -ForegroundColor Yellow
        Write-Host "   URL: http://127.0.0.1:8000" -ForegroundColor White
        Write-Host "   Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
        Write-Host ""
        
        # Start FastAPI in new terminal
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\mediconnect-1'; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
        
        Start-Sleep -Seconds 3
        
        Write-Host "🚀 Starting Next.js Frontend (Terminal 2)..." -ForegroundColor Yellow
        Write-Host "   URL: http://localhost:3000" -ForegroundColor White
        Write-Host ""
        
        # Start Next.js in new terminal
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\mediconnect'; npm run dev"
        
        Write-Host ""
        Write-Host "✅ Both servers starting!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Access the application:" -ForegroundColor Cyan
        Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
        Write-Host "   FHIR Page: http://localhost:3000/fhir-access" -ForegroundColor White
        Write-Host "   Backend: http://127.0.0.1:8000" -ForegroundColor White
        Write-Host "   API Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
        Write-Host ""
        Write-Host "Press any key to exit this window..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    
    "5" {
        Write-Host "Goodbye! 👋" -ForegroundColor Cyan
        exit 0
    }
    
    default {
        Write-Host "Invalid choice. Exiting." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
