"""
Pre-Deployment Security and Configuration Verification Script
Run this before deploying to ensure everything is properly configured
"""

import os
import sys
import json
from pathlib import Path

def print_status(message, status):
    """Print colored status message"""
    colors = {
        'success': '\033[92m✓\033[0m',
        'error': '\033[91m✗\033[0m',
        'warning': '\033[93m⚠\033[0m',
        'info': '\033[94mℹ\033[0m'
    }
    print(f"{colors.get(status, '•')} {message}")

def check_file_exists(filepath, required=True):
    """Check if a file exists"""
    exists = Path(filepath).exists()
    if exists:
        print_status(f"Found: {filepath}", 'success')
        return True
    else:
        status = 'error' if required else 'warning'
        print_status(f"Missing: {filepath}", status)
        return False

def check_gitignore():
    """Verify .gitignore protects sensitive files"""
    print("\n📁 Checking .gitignore...")
    
    gitignore_path = Path('.gitignore')
    if not gitignore_path.exists():
        print_status(".gitignore not found", 'error')
        return False
    
    with open(gitignore_path, 'r') as f:
        content = f.read()
    
    critical_patterns = ['.env', '*.pem', '__pycache__', 'node_modules']
    missing = []
    
    for pattern in critical_patterns:
        if pattern in content:
            print_status(f"Protected: {pattern}", 'success')
        else:
            print_status(f"Not protected: {pattern}", 'warning')
            missing.append(pattern)
    
    return len(missing) == 0

def check_env_files():
    """Check for .env files and warn if they exist"""
    print("\n🔐 Checking for .env files...")
    
    env_files = [
        '.env',
        'server_end/.env',
        'mediconnect/.env',
        'mediconnect/.env.local'
    ]
    
    found = []
    for env_file in env_files:
        if Path(env_file).exists():
            print_status(f"Found: {env_file} (OK for local dev, protected by .gitignore)", 'info')
            found.append(env_file)
    
    if not found:
        print_status("No .env files found (good for first deployment)", 'info')
    
    # Check for .env.example files
    example_files = [
        'server_end/.env.example',
        'mediconnect/.env.example'
    ]
    
    all_found = True
    for example in example_files:
        if not check_file_exists(example, required=True):
            all_found = False
    
    return all_found

def check_vercel_config():
    """Verify Vercel configuration files"""
    print("\n⚡ Checking Vercel configuration...")
    
    configs = [
        'server_end/vercel.json',
        'mediconnect/vercel.json'
    ]
    
    all_good = True
    for config in configs:
        if not check_file_exists(config, required=True):
            all_good = False
    
    return all_good

def check_security_imports():
    """Check that security modules are properly imported"""
    print("\n🔒 Checking security modules...")
    
    main_py = Path('server_end/main.py')
    if not main_py.exists():
        print_status("main.py not found", 'error')
        return False
    
    with open(main_py, 'r') as f:
        content = f.read()
    
    checks = {
        'CORS': 'CORSMiddleware' in content,
        'JWT': 'jwt' in content,
        'Encryption': 'encrypt' in content and 'decrypt' in content,
        'Bcrypt': 'bcrypt' in content,
        'Env Variables': 'os.getenv' in content
    }
    
    for check, passed in checks.items():
        if passed:
            print_status(f"{check} configured", 'success')
        else:
            print_status(f"{check} missing", 'error')
    
    return all(checks.values())

def check_requirements():
    """Verify Python requirements.txt"""
    print("\n📦 Checking Python dependencies...")
    
    req_file = Path('server_end/requirements.txt')
    if not req_file.exists():
        print_status("requirements.txt not found", 'error')
        return False
    
    with open(req_file, 'r') as f:
        content = f.read()
    
    critical_deps = ['fastapi', 'motor', 'bcrypt', 'cryptography', 'python-jose', 'httpx']
    
    for dep in critical_deps:
        if dep in content:
            print_status(f"Found: {dep}", 'success')
        else:
            print_status(f"Missing: {dep}", 'error')
    
    return True

def check_next_config():
    """Verify Next.js configuration"""
    print("\n⚛️  Checking Next.js configuration...")
    
    config_file = Path('mediconnect/next.config.ts')
    if not config_file.exists():
        print_status("next.config.ts not found", 'error')
        return False
    
    with open(config_file, 'r') as f:
        content = f.read()
    
    security_headers = [
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection'
    ]
    
    for header in security_headers:
        if header in content:
            print_status(f"Security header: {header}", 'success')
        else:
            print_status(f"Missing header: {header}", 'warning')
    
    return True

def check_documentation():
    """Verify documentation files exist"""
    print("\n📚 Checking documentation...")
    
    docs = [
        'README.md',
        'DEPLOYMENT.md',
        'QUICKSTART_DEPLOY.md',
        'SECURITY_AUDIT.md',
        'PRODUCTION_READINESS.md'
    ]
    
    all_found = True
    for doc in docs:
        if not check_file_exists(doc, required=False):
            all_found = False
    
    return all_found

def main():
    """Run all checks"""
    print("=" * 60)
    print("🔍 MediConnect Pre-Deployment Verification")
    print("=" * 60)
    
    checks = [
        ("Git Security", check_gitignore),
        ("Environment Files", check_env_files),
        ("Vercel Config", check_vercel_config),
        ("Security Modules", check_security_imports),
        ("Python Dependencies", check_requirements),
        ("Next.js Config", check_next_config),
        ("Documentation", check_documentation),
    ]
    
    results = {}
    for name, check_func in checks:
        try:
            results[name] = check_func()
        except Exception as e:
            print_status(f"Error in {name}: {str(e)}", 'error')
            results[name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = 'success' if result else 'error'
        print_status(name, status)
    
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n" + "=" * 60)
        print_status("✨ All checks passed! Ready for deployment! ✨", 'success')
        print("=" * 60)
        print("\nNext steps:")
        print("1. Read QUICKSTART_DEPLOY.md")
        print("2. Generate your secrets")
        print("3. Deploy to Vercel")
        return 0
    else:
        print("\n" + "=" * 60)
        print_status("⚠️  Some checks failed. Review above.", 'warning')
        print("=" * 60)
        print("\nFix the issues before deploying.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
