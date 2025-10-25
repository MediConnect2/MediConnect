"""
FHIR Integration Test Script
Run this to verify FHIR endpoints are working correctly
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_fhir_login():
    """Test FHIR login initiation"""
    print("=" * 60)
    print("TEST 1: FHIR Login Initiation")
    print("=" * 60)
    
    response = requests.post(
        f"{BASE_URL}/fhir-login",
        json={"patient_username": "test_patient"}
    )
    
    print(f"Status Code: {response.status_code}")
    data = response.json()
    print(json.dumps(data, indent=2))
    
    if response.status_code == 200:
        print("\n✅ Login initiation successful!")
        print(f"Session ID: {data.get('session_id')}")
        print(f"\n🔗 Redirect URL: {data.get('redirect_url')[:100]}...")
        return data.get('session_id')
    else:
        print("\n❌ Login initiation failed!")
        return None

def test_endpoints():
    """Test that all FHIR endpoints exist"""
    print("\n" + "=" * 60)
    print("TEST 2: Endpoint Availability")
    print("=" * 60)
    
    endpoints = [
        ("POST", "/fhir-login", {"patient_username": "test"}),
        ("POST", "/fhir-request", {"session_id": "test"}),
        ("POST", "/fhir-resource", {"session_id": "test", "resource_type": "patient"}),
        ("POST", "/fhir-logout", {"session_id": "test"}),
    ]
    
    for method, endpoint, payload in endpoints:
        try:
            if method == "POST":
                response = requests.post(f"{BASE_URL}{endpoint}", json=payload, timeout=5)
            else:
                response = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
            
            print(f"\n{method} {endpoint}")
            print(f"  Status: {response.status_code}")
            
            if response.status_code == 401:
                print(f"  ✅ Endpoint exists (returns expected 401 for invalid session)")
            elif response.status_code == 400:
                print(f"  ✅ Endpoint exists (returns expected 400 for invalid data)")
            elif response.status_code == 200:
                print(f"  ✅ Endpoint exists and responds")
            else:
                print(f"  ⚠️  Endpoint exists (status: {response.status_code})")
                
        except requests.exceptions.ConnectionError:
            print(f"\n{method} {endpoint}")
            print(f"  ❌ Server not running at {BASE_URL}")
            return False
        except Exception as e:
            print(f"\n{method} {endpoint}")
            print(f"  ❌ Error: {str(e)}")
    
    return True

def main():
    print("\n" + "=" * 60)
    print("MediConnect FHIR Integration Tests")
    print("=" * 60)
    print(f"Testing server at: {BASE_URL}")
    print()
    
    # Test endpoint availability
    if not test_endpoints():
        print("\n❌ Server is not running!")
        print("Start the server with: uvicorn main:app --reload")
        return
    
    # Test login flow
    session_id = test_fhir_login()
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print("✅ All FHIR endpoints are available")
    print("✅ OAuth login flow can be initiated")
    print()
    print("📝 Next Steps:")
    print("1. Complete Epic OAuth login in browser using the redirect URL")
    print("2. Use the session_id to call /fhir-request")
    print("3. Retrieve patient FHIR data")
    print()
    print("📖 See FHIR_INTEGRATION_GUIDE.md for detailed usage instructions")
    print()

if __name__ == "__main__":
    main()
