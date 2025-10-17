from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_patient_info():
    response = client.get("/api/patients/1")
    assert response.status_code == 200
    assert "name" in response.json()
    assert "id" in response.json()

def test_get_patient_info_not_found():
    response = client.get("/api/patients/999")
    assert response.status_code == 404

def test_login():
    response = client.post("/api/login", data={"username": "testuser", "password": "testpass"})
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_callback():
    response = client.get("/api/callback")
    assert response.status_code == 200
    assert "state" in response.url

def test_fetch_patient_data():
    response = client.get("/api/fhir/patient/1")
    assert response.status_code == 200
    assert "resourceType" in response.json() and response.json()["resourceType"] == "Patient"