"""
Example FHIR Client Implementation
Demonstrates how to use the MediConnect FHIR API endpoints
"""
import requests
import json
import webbrowser
import time

BASE_URL = "http://localhost:8000"

class FHIRClient:
    """Simple client for MediConnect FHIR API"""
    
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url
        self.session_id = None
        self.patient_id = None
    
    def login(self, patient_username: str):
        """
        Initiate FHIR OAuth login
        
        Returns:
            redirect_url: URL to redirect patient to for Epic authentication
        """
        print(f"🔐 Initiating FHIR login for: {patient_username}")
        
        response = requests.post(
            f"{self.base_url}/fhir-login",
            json={"patient_username": patient_username}
        )
        
        if response.status_code != 200:
            raise Exception(f"Login failed: {response.text}")
        
        data = response.json()
        self.session_id = data['session_id']
        redirect_url = data['redirect_url']
        
        print(f"✅ Session created: {self.session_id}")
        print(f"🔗 Redirect URL: {redirect_url[:80]}...")
        
        return redirect_url
    
    def open_epic_login(self, patient_username: str):
        """
        Initiate login and automatically open Epic login in browser
        """
        redirect_url = self.login(patient_username)
        
        print("\n📱 Opening Epic login in browser...")
        print("Please complete the login and come back here.\n")
        
        webbrowser.open(redirect_url)
        
        # Wait for user to complete login
        input("Press Enter after completing Epic login...")
        
        return self.session_id
    
    def get_patient_data(self, session_id=None):
        """
        Fetch comprehensive patient FHIR data
        
        Args:
            session_id: Optional session ID (uses stored if not provided)
        
        Returns:
            dict: Patient FHIR data
        """
        sid = session_id or self.session_id
        
        if not sid:
            raise Exception("No session ID. Call login() first.")
        
        print(f"📊 Fetching patient data for session: {sid}")
        
        response = requests.post(
            f"{self.base_url}/fhir-request",
            json={"session_id": sid}
        )
        
        if response.status_code != 200:
            raise Exception(f"Data fetch failed: {response.text}")
        
        data = response.json()
        self.patient_id = data['data']['patient_id']
        
        print(f"✅ Data retrieved for patient: {self.patient_id}")
        
        return data['data']
    
    def get_resource(self, resource_type: str, category=None, session_id=None):
        """
        Fetch a specific FHIR resource type
        
        Args:
            resource_type: Type of resource (patient, allergies, observations, etc.)
            category: Optional category for observations
            session_id: Optional session ID
        
        Returns:
            dict: FHIR resource data
        """
        sid = session_id or self.session_id
        
        if not sid:
            raise Exception("No session ID. Call login() first.")
        
        payload = {
            "session_id": sid,
            "resource_type": resource_type
        }
        
        if category:
            payload["category"] = category
        
        print(f"📋 Fetching {resource_type}...")
        
        response = requests.post(
            f"{self.base_url}/fhir-resource",
            json=payload
        )
        
        if response.status_code != 200:
            raise Exception(f"Resource fetch failed: {response.text}")
        
        data = response.json()
        print(f"✅ {resource_type} retrieved")
        
        return data['data']
    
    def logout(self, session_id=None):
        """Clear FHIR session"""
        sid = session_id or self.session_id
        
        if not sid:
            return
        
        print(f"🚪 Logging out session: {sid}")
        
        response = requests.post(
            f"{self.base_url}/fhir-logout",
            json={"session_id": sid}
        )
        
        if response.status_code == 200:
            print("✅ Session cleared")
            self.session_id = None
            self.patient_id = None
        else:
            print(f"⚠️ Logout warning: {response.text}")
    
    def print_patient_summary(self, data):
        """Print a formatted summary of patient data"""
        print("\n" + "=" * 60)
        print("PATIENT SUMMARY")
        print("=" * 60)
        
        # Patient Demographics
        patient = data.get('patient', {})
        if patient:
            name = patient.get('name', [{}])[0]
            given = ' '.join(name.get('given', []))
            family = name.get('family', '')
            
            print(f"\n👤 Name: {given} {family}")
            print(f"🆔 Patient ID: {patient.get('id', 'N/A')}")
            print(f"🎂 Birth Date: {patient.get('birthDate', 'N/A')}")
            print(f"⚧️ Gender: {patient.get('gender', 'N/A')}")
        
        # Allergies
        allergies = data.get('allergies', {}).get('entry', [])
        print(f"\n🌰 Allergies: {len(allergies)} found")
        for entry in allergies[:3]:  # Show first 3
            resource = entry.get('resource', {})
            code = resource.get('code', {})
            display = code.get('coding', [{}])[0].get('display', 'Unknown')
            print(f"  - {display}")
        
        # Conditions
        conditions = data.get('conditions', {}).get('entry', [])
        print(f"\n🏥 Conditions: {len(conditions)} found")
        for entry in conditions[:3]:
            resource = entry.get('resource', {})
            code = resource.get('code', {})
            display = code.get('coding', [{}])[0].get('display', 'Unknown')
            print(f"  - {display}")
        
        # Medications
        medications = data.get('medications', {}).get('entry', [])
        print(f"\n💊 Medications: {len(medications)} found")
        
        # Observations
        observations = data.get('observations', {}).get('entry', [])
        print(f"\n📊 Observations: {len(observations)} found")
        
        # Procedures
        procedures = data.get('procedures', {}).get('entry', [])
        print(f"\n🔬 Procedures: {len(procedures)} found")
        
        # Immunizations
        immunizations = data.get('immunizations', {}).get('entry', [])
        print(f"\n💉 Immunizations: {len(immunizations)} found")
        
        # Errors
        errors = data.get('errors', [])
        if errors:
            print(f"\n⚠️ Errors: {len(errors)}")
            for error in errors:
                print(f"  - {error['resource']}: {error['error'][:60]}...")
        
        print("\n" + "=" * 60)


def example_interactive_flow():
    """Interactive example - guides user through complete flow"""
    print("\n" + "=" * 60)
    print("MediConnect FHIR API - Interactive Example")
    print("=" * 60)
    
    client = FHIRClient()
    
    # Get patient username
    username = input("\nEnter patient username (or press Enter for 'test_patient'): ").strip()
    if not username:
        username = "test_patient"
    
    try:
        # Step 1: Login
        print(f"\n{'='*60}")
        print("STEP 1: FHIR OAuth Login")
        print(f"{'='*60}")
        client.open_epic_login(username)
        
        # Step 2: Fetch data
        print(f"\n{'='*60}")
        print("STEP 2: Fetch Patient Data")
        print(f"{'='*60}")
        patient_data = client.get_patient_data()
        
        # Step 3: Display summary
        client.print_patient_summary(patient_data)
        
        # Step 4: Optional - fetch specific resources
        print(f"\n{'='*60}")
        print("STEP 3: Fetch Specific Resources (Optional)")
        print(f"{'='*60}")
        
        choice = input("\nFetch vital signs? (y/n): ").strip().lower()
        if choice == 'y':
            vitals = client.get_resource("observations", category="vital-signs")
            print(f"\n📊 Vital Signs:")
            print(json.dumps(vitals, indent=2)[:500] + "...")
        
        # Step 5: Logout
        print(f"\n{'='*60}")
        print("STEP 4: Logout")
        print(f"{'='*60}")
        client.logout()
        
        print("\n✅ Example completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        client.logout()


def example_programmatic():
    """Programmatic example - shows how to use in code"""
    print("\n" + "=" * 60)
    print("MediConnect FHIR API - Programmatic Example")
    print("=" * 60)
    
    client = FHIRClient()
    
    try:
        # Login (would redirect user in real app)
        redirect_url = client.login("patient_123")
        print(f"Redirect user to: {redirect_url}")
        
        # Simulate user completing login
        print("\n(Simulating user completed Epic login...)")
        # In real app, you'd wait for callback
        
        # Fetch data (this would fail without real Epic login)
        # patient_data = client.get_patient_data()
        # client.print_patient_summary(patient_data)
        
        print("\nIn real implementation:")
        print("1. User completes Epic login")
        print("2. Epic redirects to /fhir-callback")
        print("3. Your app calls get_patient_data()")
        print("4. Display patient medical records")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
    finally:
        client.logout()


if __name__ == "__main__":
    print("\nChoose example:")
    print("1. Interactive (with browser login)")
    print("2. Programmatic (code example)")
    
    choice = input("\nEnter choice (1 or 2): ").strip()
    
    if choice == "1":
        example_interactive_flow()
    else:
        example_programmatic()
