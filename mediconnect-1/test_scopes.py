#!/usr/bin/env python3
"""
Test script to verify Epic FHIR scopes and API access.
This script checks what scopes were granted and tests each FHIR resource endpoint.

Usage:
    python test_scopes.py

Make sure you're logged in to the app first, then run this script.
"""

import httpx
import json
import sys
from typing import Dict, Any, Optional
from datetime import datetime

# API Base URL
API_BASE = "https://localhost:8000"

def print_header(text: str):
    """Print a formatted header"""
    print("\n" + "=" * 80)
    print(f"  {text}")
    print("=" * 80)

def print_success(text: str):
    """Print success message"""
    print(f"✅ {text}")

def print_error(text: str):
    """Print error message"""
    print(f"❌ {text}")

def print_warning(text: str):
    """Print warning message"""
    print(f"⚠️  {text}")

def print_info(text: str):
    """Print info message"""
    print(f"ℹ️  {text}")

async def check_auth_status() -> Optional[Dict[str, Any]]:
    """Check if user is authenticated"""
    print_header("Step 1: Checking Authentication Status")
    
    print_info("Note: This script checks the backend's in-memory session store")
    print_info("If you're logged in via browser, the session might not be shared")
    print_info("Checking all available sessions...")
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                f"{API_BASE}/api/auth-status",
                timeout=10.0
            )
            
            if response.status_code == 200:
                auth_data = response.json()
                
                if auth_data.get('authenticated'):
                    print_success("Authenticated!")
                    print_info(f"Patient ID: {auth_data.get('patient_id', 'Unknown')}")
                    print_info(f"Token Type: {auth_data.get('token_type', 'Unknown')}")
                    
                    # Show granted scopes
                    granted_scopes = auth_data.get('scope', '')
                    if granted_scopes:
                        print_info(f"Granted Scopes:")
                        for scope in granted_scopes.split():
                            print(f"    • {scope}")
                    
                    return auth_data
                else:
                    print_error("Not authenticated")
                    print_info("Please log in at: http://localhost:3000/fhir-access")
                    return None
            else:
                print_error(f"Auth check failed with status {response.status_code}")
                return None
                
    except Exception as e:
        print_error(f"Failed to check auth status: {str(e)}")
        return None

async def check_scope_diagnostic() -> Optional[Dict[str, Any]]:
    """Get detailed scope diagnostic information"""
    print_header("Step 2: Checking Scope Configuration")
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                f"{API_BASE}/api/scope-diagnostic",
                timeout=10.0
            )
            
            if response.status_code == 200:
                diag_data = response.json()
                
                print_info("Scope Analysis:")
                print(f"\n  Requested: {len(diag_data.get('requested_scopes', []))} scopes")
                print(f"  Granted:   {len(diag_data.get('granted_scopes', []))} scopes")
                print(f"  Denied:    {len(diag_data.get('missing_scopes', []))} scopes")
                
                # Show granted scopes
                if diag_data.get('granted_scopes'):
                    print("\n  ✅ Granted Scopes:")
                    for scope in diag_data['granted_scopes']:
                        print(f"    • {scope}")
                
                # Show denied scopes
                if diag_data.get('missing_scopes'):
                    print("\n  ❌ Denied Scopes (NOT configured in Epic app):")
                    for scope in diag_data['missing_scopes']:
                        print(f"    • {scope}")
                    
                    print_warning(f"\n{len(diag_data['missing_scopes'])} scope(s) need to be added in Epic app!")
                    print_info("Fix at: https://fhir.epic.com/Developer/Apps")
                else:
                    print_success("\nAll requested scopes were granted! ✨")
                
                return diag_data
                
            else:
                print_error(f"Scope diagnostic failed with status {response.status_code}")
                return None
                
    except Exception as e:
        print_error(f"Failed to get scope diagnostic: {str(e)}")
        return None

async def test_fhir_endpoints(patient_id: str) -> Dict[str, bool]:
    """Test each FHIR endpoint to see what works"""
    print_header("Step 3: Testing FHIR Resource Access")
    
    results = {}
    
    # Define endpoints to test
    endpoints = [
        {
            'name': 'Patient Demographics',
            'path': f'/api/patient/{patient_id}',
            'scope': 'patient/Patient.read'
        },
        {
            'name': 'Allergies',
            'path': '/api/allergies',
            'scope': 'patient/AllergyIntolerance.read'
        },
        {
            'name': 'Conditions',
            'path': '/api/conditions',
            'scope': 'patient/Condition.read'
        },
        {
            'name': 'Medications',
            'path': '/api/medications',
            'scope': 'patient/MedicationRequest.read'
        },
        {
            'name': 'Vital Signs',
            'path': '/api/vital-signs',
            'scope': 'patient/Observation.read'
        },
        {
            'name': 'Procedures',
            'path': '/api/procedures',
            'scope': 'patient/Procedure.read'
        }
    ]
    
    async with httpx.AsyncClient(verify=False) as client:
        for endpoint in endpoints:
            name = endpoint['name']
            path = endpoint['path']
            scope = endpoint['scope']
            
            print(f"\n  Testing: {name}")
            print(f"  Endpoint: {path}")
            print(f"  Required Scope: {scope}")
            
            try:
                response = await client.get(
                    f"{API_BASE}{path}",
                    timeout=15.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check if we got data
                    has_data = False
                    if 'entry' in data:
                        has_data = len(data.get('entry', [])) > 0
                    elif isinstance(data, dict) and len(data) > 0:
                        has_data = True
                    elif isinstance(data, list):
                        has_data = len(data) > 0
                    
                    if has_data:
                        print_success(f"SUCCESS - Got data!")
                        
                        # Show sample data
                        if 'entry' in data:
                            print(f"    → {len(data['entry'])} resource(s) returned")
                        elif 'summary' in data:
                            summary = data['summary']
                            if isinstance(summary, list) and summary:
                                print(f"    → Sample: {summary[0]}")
                        
                    else:
                        print_warning(f"SUCCESS but no data (may be empty for this patient)")
                    
                    results[name] = True
                    
                elif response.status_code == 403:
                    print_error(f"DENIED (403 Forbidden)")
                    print_warning(f"  → Scope '{scope}' not granted by Epic")
                    results[name] = False
                    
                elif response.status_code == 401:
                    print_error(f"UNAUTHORIZED (401)")
                    print_warning("  → Session may have expired, try logging in again")
                    results[name] = False
                    
                else:
                    print_error(f"FAILED with status {response.status_code}")
                    error_text = response.text[:200] if response.text else "No error details"
                    print(f"    → {error_text}")
                    results[name] = False
                    
            except httpx.TimeoutException:
                print_error(f"TIMEOUT - Request took too long")
                results[name] = False
            except Exception as e:
                print_error(f"ERROR: {str(e)}")
                results[name] = False
    
    return results

def print_summary(scope_diag: Optional[Dict], test_results: Dict[str, bool]):
    """Print a summary of the test results"""
    print_header("Test Summary")
    
    # Scope summary
    if scope_diag:
        missing = scope_diag.get('missing_scopes', [])
        granted = scope_diag.get('granted_scopes', [])
        
        print(f"\n📊 Scope Status:")
        print(f"  ✅ Granted: {len(granted)} scopes")
        print(f"  ❌ Denied:  {len(missing)} scopes")
        
        if missing:
            print(f"\n⚠️  Missing Scopes (Need to add in Epic app):")
            for scope in missing:
                print(f"    • {scope}")
    
    # Test results summary
    print(f"\n🧪 FHIR Endpoint Tests:")
    passed = sum(1 for result in test_results.values() if result)
    failed = len(test_results) - passed
    
    for name, success in test_results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\n  Total: {passed} passed, {failed} failed out of {len(test_results)} tests")
    
    # Recommendations
    if failed > 0:
        print_header("🔧 How to Fix")
        print("""
1. Go to: https://fhir.epic.com/Developer/Apps
2. Find your app with Client ID: 1a3aabaa-38dd-4a03-ac3a-38de1c40cae2
3. Click "Edit Application"
4. Find the "FHIR Scopes" section
5. Move missing scopes from "Available" to "Selected" column
6. Click "Save"
7. Log out and log back in to get a fresh OAuth token

For detailed instructions, see:
  • SOLUTION_SUMMARY.md
  • SCOPE_FIX_INSTRUCTIONS.md
        """)
    else:
        print_success("\n🎉 All tests passed! Your Epic app is properly configured!")

async def main():
    """Main test function"""
    print("\n" + "🔍" * 40)
    print("  MediConnect FHIR Scope Test Script")
    print("🔍" * 40)
    
    print_info(f"Testing against: {API_BASE}")
    print_info(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Step 1: Check auth status
    auth_data = await check_auth_status()
    if not auth_data:
        print_error("\n❌ Cannot proceed without authentication")
        print_info("Please log in at: http://localhost:3000/fhir-access")
        print_info("Then run this script again.")
        sys.exit(1)
    
    patient_id = auth_data.get('patient_id')
    if not patient_id or patient_id in ['Unknown', 'PRACTITIONER_LOGIN']:
        print_error("\n❌ No valid patient ID found")
        print_info("Make sure you're logged in as a patient (not practitioner)")
        sys.exit(1)
    
    # Step 2: Check scope diagnostic
    scope_diag = await check_scope_diagnostic()
    
    # Step 3: Test FHIR endpoints
    test_results = await test_fhir_endpoints(patient_id)
    
    # Step 4: Print summary
    print_summary(scope_diag, test_results)
    
    print("\n" + "=" * 80)
    print("  Test Complete!")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    import asyncio
    
    # Suppress SSL warnings
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Test failed with error: {str(e)}")
        sys.exit(1)
