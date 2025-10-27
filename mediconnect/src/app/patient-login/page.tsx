'use client'

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';

interface PatientData {
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth?: string;
  blood_type?: string;
  allergies?: string[];
  medications?: string[];
  medical_conditions?: string[];
  emergency_contact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  insurance?: {
    provider: string;
    policy_number: string;
  };
  primary_care_physician?: {
    name: string;
    phone: string;
    practice: string;
  };
  last_visit?: string;
  vital_signs?: {
    blood_pressure: string;
    heart_rate: string;
    temperature: string;
    oxygen_saturation: string;
  };
}

export default function PatientLoginPage() {
  const [formData, setFormData] = useState({
    mediconnect_username: "",
    password: "",
    first_name: "",
    last_name: "",
    driver_license_id: "",
    fingerprint_data: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillUsername = searchParams?.get('username') ?? '';

  useEffect(() => {
    // Prefill username if an EMT redirected here with a target patient username
    if (prefillUsername) {
      setFormData(prev => ({ ...prev, mediconnect_username: prefillUsername.toLowerCase() }));
    }
    const checkToken = async () => {
      const token = localStorage.getItem('emt_token');
      if (!token) {
        alert("Unauthorized: EMT not Logged In");
        router.push('/');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/verify-emt-token`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });

        if (!response.ok) {
          localStorage.removeItem('emt_token');
          // Notify Navbar of login status change
          window.dispatchEvent(new Event('loginStatusChanged'));
          throw new Error('Token is invalid');
        }

        const data = (await response).json();
        console.log('Token is valid', data);
      } catch (error) {
        console.log(error);
        localStorage.removeItem('emt_token');
        // Notify Navbar of login status change
        window.dispatchEvent(new Event('loginStatusChanged'));
        alert("Unauthorized: EMT not Logged In");
        router.push('/');
        return;
      }

      // Check if patient is already logged in
      const patientToken = localStorage.getItem('patient_token');
      if (patientToken) {
        try {
          const response = await fetch(`${API_BASE}/verify-patient-token`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${patientToken}`,
            }
          });

          if (!response.ok) {
            localStorage.removeItem('patient_token');
            
            // Notify Navbar of login status change
            window.dispatchEvent(new Event('loginStatusChanged'));
            
            throw new Error('Patient token is invalid');
          }

          const patientTokenData = await response.json();
          console.log('Patient Token is valid', patientTokenData);
          
          // Fetch actual patient profile data
          const username = patientTokenData.sub; // JWT contains username in 'sub' field
          const profileResponse = await fetch(`${API_BASE}/patient/profile/${username}`);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            
            // Parse FHIR data if available
            const fhirData = profileData.fhir_data || {};
            
            // Extract allergies from FHIR
            const allergies: string[] = [];
            if (fhirData.allergies?.entry) {
              fhirData.allergies.entry.forEach((entry: any) => {
                const allergyName = entry.resource?.code?.coding?.[0]?.display || 
                                   entry.resource?.code?.text || 
                                   "Unknown Allergy";
                allergies.push(allergyName);
              });
            }
            if (profileData.manual_allergies) {
              allergies.push(...profileData.manual_allergies.split(',').map((a: string) => a.trim()));
            }
            
            // Extract medications from FHIR
            const medications: string[] = [];
            if (fhirData.medications?.entry) {
              fhirData.medications.entry.forEach((entry: any) => {
                const medName = entry.resource?.medicationCodeableConcept?.coding?.[0]?.display ||
                               entry.resource?.medicationCodeableConcept?.text ||
                               "Unknown Medication";
                medications.push(medName);
              });
            }
            if (profileData.manual_medications) {
              medications.push(...profileData.manual_medications.split(',').map((m: string) => m.trim()));
            }
            
            // Extract conditions from FHIR
            const medical_conditions: string[] = [];
            if (fhirData.conditions?.entry) {
              fhirData.conditions.entry.forEach((entry: any) => {
                const condName = entry.resource?.code?.coding?.[0]?.display ||
                                entry.resource?.code?.text ||
                                "Unknown Condition";
                medical_conditions.push(condName);
              });
            }
            if (profileData.manual_conditions) {
              medical_conditions.push(...profileData.manual_conditions.split(',').map((c: string) => c.trim()));
            }
            
            // Build patient data from real profile
            const realPatientData: PatientData = {
              first_name: profileData.first_name,
              last_name: profileData.last_name,
              middle_name: profileData.middle_name || undefined,
              date_of_birth: profileData.date_of_birth || undefined,
              blood_type: profileData.blood_type || undefined,
              allergies: allergies.length > 0 ? allergies : undefined,
              medications: medications.length > 0 ? medications : undefined,
              medical_conditions: medical_conditions.length > 0 ? medical_conditions : undefined,
              emergency_contact: profileData.emergency_contact_name ? {
                name: profileData.emergency_contact_name,
                phone: profileData.emergency_contact_phone || "",
                relationship: "Emergency Contact"
              } : undefined,
              insurance: profileData.insurance_provider ? {
                provider: profileData.insurance_provider,
                policy_number: profileData.insurance_policy_number || ""
              } : undefined
            };

            setPatientData(realPatientData);
          } else {
            // Fallback to basic data from token
            setPatientData({
              first_name: patientTokenData.first_name || "Patient",
              last_name: patientTokenData.last_name || ""
            });
          }
          setIsLoggedIn(true);
        } catch (error) {
          console.log('Patient token validation error:', error);
          localStorage.removeItem('patient_token');
          
          // Notify Navbar of login status change
          window.dispatchEvent(new Event('loginStatusChanged'));
          
          setIsLoggedIn(false);
          setPatientData(null);
        }
      }
    };

    checkToken();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    const lowercaseFields = ['mediconnect_username', 'first_name', 'last_name'];
    
    if (name === 'driver_license_id') {
      const numericValue = value.replace(/\D/g, '');
      setFormData({ ...formData, [name]: numericValue });
      return;
    }

    setFormData({ 
      ...formData, 
      [name]: lowercaseFields.includes(name) ? value.toLowerCase() : value 
    });
  };

  const isValid = () => {
    const { mediconnect_username, password, first_name, last_name, driver_license_id, fingerprint_data } = formData;

    return (
      (mediconnect_username && password) ||
      (first_name && last_name && driver_license_id) ||
      fingerprint_data
    );
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!isValid()) {
      setError("Please enter sufficient login credentials using one of the available methods.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/patient/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        
        localStorage.setItem('patient_token', data['access_token']);
        
        // Notify Navbar of login status change
        window.dispatchEvent(new Event('loginStatusChanged'));
        
        // Fetch actual patient profile data
        const username = data.patient_info?.first_name ? 
          formData.mediconnect_username : 
          formData.first_name; // Use the username they logged in with
        
        const profileResponse = await fetch(`${API_BASE}/patient/profile/${data.patient_info.first_name ? formData.mediconnect_username : username}`);
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          
          // Parse FHIR data if available
          const fhirData = profileData.fhir_data || {};
          
          // Extract allergies from FHIR
          const allergies: string[] = [];
          if (fhirData.allergies?.entry) {
            fhirData.allergies.entry.forEach((entry: any) => {
              const allergyName = entry.resource?.code?.coding?.[0]?.display || 
                                 entry.resource?.code?.text || 
                                 "Unknown Allergy";
              allergies.push(allergyName);
            });
          }
          if (profileData.manual_allergies) {
            allergies.push(...profileData.manual_allergies.split(',').map((a: string) => a.trim()));
          }
          
          // Extract medications from FHIR
          const medications: string[] = [];
          if (fhirData.medications?.entry) {
            fhirData.medications.entry.forEach((entry: any) => {
              const medName = entry.resource?.medicationCodeableConcept?.coding?.[0]?.display ||
                             entry.resource?.medicationCodeableConcept?.text ||
                             "Unknown Medication";
              medications.push(medName);
            });
          }
          if (profileData.manual_medications) {
            medications.push(...profileData.manual_medications.split(',').map((m: string) => m.trim()));
          }
          
          // Extract conditions from FHIR
          const medical_conditions: string[] = [];
          if (fhirData.conditions?.entry) {
            fhirData.conditions.entry.forEach((entry: any) => {
              const condName = entry.resource?.code?.coding?.[0]?.display ||
                              entry.resource?.code?.text ||
                              "Unknown Condition";
              medical_conditions.push(condName);
            });
          }
          if (profileData.manual_conditions) {
            medical_conditions.push(...profileData.manual_conditions.split(',').map((c: string) => c.trim()));
          }
          
          // Build patient data from real profile
          const realPatientData: PatientData = {
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            middle_name: profileData.middle_name || undefined,
            date_of_birth: profileData.date_of_birth || undefined,
            blood_type: profileData.blood_type || undefined,
            allergies: allergies.length > 0 ? allergies : undefined,
            medications: medications.length > 0 ? medications : undefined,
            medical_conditions: medical_conditions.length > 0 ? medical_conditions : undefined,
            emergency_contact: profileData.emergency_contact_name ? {
              name: profileData.emergency_contact_name,
              phone: profileData.emergency_contact_phone || "",
              relationship: "Emergency Contact"
            } : undefined,
            insurance: profileData.insurance_provider ? {
              provider: profileData.insurance_provider,
              policy_number: profileData.insurance_policy_number || ""
            } : undefined
          };

          setPatientData(realPatientData);
        } else {
          // Fallback to data from login response
          setPatientData({
            first_name: data.patient_info.first_name,
            last_name: data.patient_info.last_name,
            middle_name: data.patient_info.middle_name || undefined
          });
        }
        
        // Check if EMT is logged in - if so, redirect to patient dashboard
        const emtToken = localStorage.getItem('emt_token');
        if (emtToken) {
          // EMT is logged in, redirect to patient dashboard
          const patientUsername = formData.mediconnect_username || formData.first_name;
          router.push(`/patient-dashboard?username=${encodeURIComponent(patientUsername)}`);
        } else {
          // Regular patient login, show the patient info page
          setIsLoggedIn(true);
        }
        
      } else {
        const err = await response.json();
        setError(`Login failed: ${err.detail || "Unknown error"}`);
      }
    } catch (err) {
      setError("Server error during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  const handleEMTLogout = () => {
    localStorage.removeItem('emt_token');
    localStorage.removeItem('patient_token'); // Also clear patient token
    
    // Notify Navbar of login status change
    window.dispatchEvent(new Event('loginStatusChanged'));
    
    router.push('/');
  };

  const handlePatientLogout = async () => {
    localStorage.removeItem('patient_token');
    
    // Notify Navbar of login status change
    window.dispatchEvent(new Event('loginStatusChanged'));
    
    setIsLoggedIn(false);
    setPatientData(null);
    setFormData({
      mediconnect_username: "",
      password: "",
      first_name: "",
      last_name: "",
      driver_license_id: "",
      fingerprint_data: "",
    });
    setError("");

    // Re-validate EMT token when returning to login
    const emtToken = localStorage.getItem('emt_token');
    if (!emtToken) {
      alert("Unauthorized: EMT not Logged In");
      router.push('/');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/verify-emt-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${emtToken}`,
        }
      });

      if (!response.ok) {
        localStorage.removeItem('emt_token');
        // Notify Navbar of login status change
        window.dispatchEvent(new Event('loginStatusChanged'));
        alert("EMT session expired. Please login again.");
        router.push('/');
        return;
      }

      console.log('EMT token still valid');
    } catch (error) {
  console.log('EMT token validation error:', error);
  localStorage.removeItem('emt_token');
  // Notify Navbar of login status change
  window.dispatchEvent(new Event('loginStatusChanged'));
  alert("EMT session expired. Please login again.");
  router.push('/');
    }
  };

  // Patient Information Display
  if (isLoggedIn && patientData) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        paddingTop: '120px',
        paddingBottom: '2rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
          padding: '3rem', 
          borderRadius: '32px',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          maxWidth: '1200px',
          margin: '0 auto',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
        }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '3rem'
          }}>
            <h1 style={{ 
              margin: 0,
              color: '#1a365d',
              fontSize: '2.5rem',
              fontWeight: '700',
              letterSpacing: '-0.025em',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              Emergency Patient Information
            </h1>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={handlePatientLogout}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0px)';
                }}
              >
                Patient Logout
              </button>
              <button 
                onClick={handleEMTLogout}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ef4444';
                  e.currentTarget.style.transform = 'translateY(0px)';
                }}
              >
                EMT Logout
              </button>
            </div>
          </div>

          {/* Patient Info Grid - keeping all existing patient display code */}
          <div style={{ 
            display: 'grid', 
            gap: '2rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))'
          }}>
            {/* Basic Information */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
            }}>
              <h3 style={{ 
                color: '#1e40af', 
                marginBottom: '1.5rem',
                fontSize: '1.5rem',
                fontWeight: '700',
                borderBottom: '3px solid #3b82f6',
                paddingBottom: '0.75rem'
              }}>
                Patient Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <strong style={{ color: '#475569' }}>Full Name:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    {patientData.first_name} {patientData.middle_name} {patientData.last_name}
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Date of Birth:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    {patientData.date_of_birth}
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Blood Type:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#dc2626', fontWeight: '600' }}>
                    {patientData.blood_type}
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
            }}>
              <h3 style={{ 
                color: '#dc2626', 
                marginBottom: '1.5rem',
                fontSize: '1.5rem',
                fontWeight: '700',
                borderBottom: '3px solid #ef4444',
                paddingBottom: '0.75rem'
              }}>
                Emergency Contact
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <strong style={{ color: '#475569' }}>Name:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    {patientData.emergency_contact?.name}
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Phone:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b', fontFamily: 'monospace' }}>
                    {patientData.emergency_contact?.phone}
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Relationship:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    {patientData.emergency_contact?.relationship}
                  </p>
                </div>
              </div>
            </div>

            {/* Allergies */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
            }}>
              <h3 style={{ 
                color: '#dc2626', 
                marginBottom: '1.5rem',
                fontSize: '1.5rem',
                fontWeight: '700',
                borderBottom: '3px solid #ef4444',
                paddingBottom: '0.75rem'
              }}>
                ⚠️ Allergies (CRITICAL)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {patientData.allergies?.map((allergy, index) => (
                  <div key={index} style={{
                    padding: '0.75rem',
                    backgroundColor: '#fef2f2',
                    borderRadius: '12px',
                    border: '2px solid #fecaca',
                    color: '#dc2626',
                    fontWeight: '600'
                  }}>
                    {allergy}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Medications */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
            }}>
              <h3 style={{ 
                color: '#059669', 
                marginBottom: '1.5rem',
                fontSize: '1.5rem',
                fontWeight: '700',
                borderBottom: '3px solid #10b981',
                paddingBottom: '0.75rem'
              }}>
                Current Medications
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {patientData.medications?.map((medication, index) => (
                  <div key={index} style={{
                    padding: '0.75rem',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '12px',
                    border: '1px solid #bbf7d0',
                    color: '#047857'
                  }}>
                    {medication}
                  </div>
                ))}
              </div>
            </div>

            {/* Medical Conditions */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
            }}>
              <h3 style={{ 
                color: '#d97706', 
                marginBottom: '1.5rem',
                fontSize: '1.5rem',
                fontWeight: '700',
                borderBottom: '3px solid #f59e0b',
                paddingBottom: '0.75rem'
              }}>
                Medical Conditions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {patientData.medical_conditions?.map((condition, index) => (
                  <div key={index} style={{
                    padding: '0.75rem',
                    backgroundColor: '#fffbeb',
                    borderRadius: '12px',
                    border: '1px solid #fed7aa',
                    color: '#92400e'
                  }}>
                    {condition}
                  </div>
                ))}
              </div>
            </div>

            {/* Vital Signs */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
            }}>
              <h3 style={{ 
                color: '#7c3aed', 
                marginBottom: '1.5rem',
                fontSize: '1.5rem',
                fontWeight: '700',
                borderBottom: '3px solid #8b5cf6',
                paddingBottom: '0.75rem'
              }}>
                Latest Vital Signs
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <strong style={{ color: '#475569' }}>Blood Pressure:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    {patientData.vital_signs?.blood_pressure}
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Heart Rate:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    {patientData.vital_signs?.heart_rate}
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>Temperature:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    {patientData.vital_signs?.temperature}
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#475569' }}>O2 Saturation:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', color: '#1e293b' }}>
                    {patientData.vital_signs?.oxygen_saturation}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Healthcare Provider Info */}
          <div style={{
            marginTop: '2rem',
            backgroundColor: '#ffffff',
            padding: '2rem',
            borderRadius: '24px',
            border: '2px solid #e5e7eb',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
          }}>
            <h3 style={{ 
              color: '#059669', 
              marginBottom: '1.5rem',
              fontSize: '1.5rem',
              fontWeight: '700',
              borderBottom: '3px solid #10b981',
              paddingBottom: '0.75rem'
            }}>
              Healthcare Provider Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <div>
                <strong style={{ color: '#475569' }}>Primary Care Physician:</strong>
                <p style={{ margin: '0.25rem 0', fontSize: '1.1rem', color: '#1e293b' }}>
                  {patientData.primary_care_physician?.name}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#6b7280', fontFamily: 'monospace' }}>
                  {patientData.primary_care_physician?.phone}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#6b7280' }}>
                  {patientData.primary_care_physician?.practice}
                </p>
              </div>
              <div>
                <strong style={{ color: '#475569' }}>Insurance:</strong>
                <p style={{ margin: '0.25rem 0', fontSize: '1.1rem', color: '#1e293b' }}>
                  {patientData.insurance?.provider}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#6b7280', fontFamily: 'monospace' }}>
                  Policy: {patientData.insurance?.policy_number}
                </p>
              </div>
              <div>
                <strong style={{ color: '#475569' }}>Last Visit:</strong>
                <p style={{ margin: '0.25rem 0', fontSize: '1.1rem', color: '#1e293b' }}>
                  {patientData.last_visit}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Login Form (rest of the code remains the same)
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      paddingTop: '120px',
      paddingBottom: '2rem',
      paddingLeft: '2rem',
      paddingRight: '2rem',
      display: 'flex', 
      alignItems: 'flex-start', 
      justifyContent: 'center',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
        padding: '3rem', 
        borderRadius: '32px',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Header with EMT Logout */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <h1 style={{ 
            margin: 0,
            color: '#1a365d',
            fontSize: '2.5rem',
            fontWeight: '700',
            letterSpacing: '-0.025em',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            Patient Login
          </h1>
          <button 
            onClick={handleEMTLogout}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '50px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(239, 68, 68, 0.3)';
            }}
          >
            EMT Logout
          </button>
        </div>

        <div style={{
          marginBottom: '2rem',
          padding: '1.25rem',
          backgroundColor: '#fef3c7',
          borderRadius: '20px',
          border: '2px solid #fbbf24'
        }}>
          <p style={{ 
            margin: 0,
            color: '#92400e',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            fontWeight: '500',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            <strong>Emergency Login:</strong> Use any one of the following methods to access patient information quickly during emergency situations.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* MediConnect Credentials Section */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '2rem',
            borderRadius: '24px',
            border: '2px solid #e5e7eb',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
          }}>
            <h3 style={{ 
              color: '#059669', 
              marginBottom: '1.5rem',
              fontSize: '1.5rem',
              fontWeight: '700',
              borderBottom: '3px solid #10b981',
              paddingBottom: '0.75rem',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              Method 1: MediConnect Credentials
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.75rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  MediConnect Username
                </label>
                <input
                  type="text"
                  name="mediconnect_username"
                  value={formData.mediconnect_username}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '1rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Enter username"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.75rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '1rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Enter password"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Name & Driver License Section */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '2rem',
            borderRadius: '24px',
            border: '2px solid #e5e7eb',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
          }}>
            <h3 style={{ 
              color: '#1e40af', 
              marginBottom: '1.5rem',
              fontSize: '1.5rem',
              fontWeight: '700',
              borderBottom: '3px solid #3b82f6',
              paddingBottom: '0.75rem',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              Method 2: Name & Driver License
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.75rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  First Name
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '1rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Enter first name"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.75rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '1rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Enter last name"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.75rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  Driver License ID
                </label>
                <input
                  type="text"
                  name="driver_license_id"
                  value={formData.driver_license_id}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '1rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Enter license ID (numbers only)"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Fingerprint Section */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '2rem',
            borderRadius: '24px',
            border: '2px solid #e5e7eb',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)'
          }}>
            <h3 style={{ 
              color: '#7c3aed', 
              marginBottom: '1.5rem',
              fontSize: '1.5rem',
              fontWeight: '700',
              borderBottom: '3px solid #8b5cf6',
              paddingBottom: '0.75rem',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              Method 3: Biometric Authentication
            </h3>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.75rem',
                color: '#374151',
                fontWeight: '600',
                fontSize: '0.95rem',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>
                Fingerprint Data
              </label>
              <input
                type="text"
                name="fingerprint_data"
                value={formData.fingerprint_data}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '16px',
                  backgroundColor: '#ffffff',
                  color: '#1f2937',
                  fontSize: '1rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none'
                }}
                placeholder="Paste fingerprint hash (development mode)"
                onFocus={(e) => {
                  e.target.style.borderColor = '#8b5cf6';
                  e.target.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <p style={{ 
                margin: '0.75rem 0 0 0',
                color: '#6b7280',
                fontSize: '0.85rem',
                fontStyle: 'italic',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>
                Biometric scanner integration coming soon
              </p>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fef2f2',
              border: '2px solid #fecaca',
              borderRadius: '16px',
              color: '#dc2626',
              fontSize: '0.9rem',
              fontWeight: '500',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid() || loading}
            style={{
              padding: '1.25rem 2rem',
              backgroundColor: (!isValid() || loading) ? '#9ca3af' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              fontSize: '1.1rem',
              fontWeight: '600',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              cursor: (!isValid() || loading) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: (!isValid() || loading) ? 'none' : '0 10px 25px rgba(220, 38, 38, 0.3)',
              transform: (!isValid() || loading) ? 'none' : 'translateY(0px)',
              marginTop: '1rem'
            }}
            onMouseEnter={(e) => {
              if (isValid() && !loading) {
                e.currentTarget.style.backgroundColor = '#b91c1c';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 15px 35px rgba(220, 38, 38, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (isValid() && !loading) {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(220, 38, 38, 0.3)';
              }
            }}
          >
            {loading ? 'Logging in...' : 'Emergency Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
