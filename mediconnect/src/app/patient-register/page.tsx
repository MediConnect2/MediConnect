'use client'

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';

export default function PatientRegisterPage(){
    const router = useRouter();
    const [step, setStep] = useState(1); // 1 = basic info, 2 = FHIR connection
    const [sessionId, setSessionId] = useState('');
    const [form,setForm] = useState({
        mediconnect_username:'',
        password:'',
        first_name:'',
        middle_name:'',
        last_name:'',
        driver_license_id:'',
        use_fingerprint: false,
        fingerprint_data: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(()=>{
        const checkToken = async () =>{
            const token = localStorage.getItem('hospital_token');
            if(!token){
                router.push('/hospital-login')
                alert("Unauthorized: Hospital not Logged In")
                return;
            }

            try{
                const response = await fetch(`${API_BASE}/verify-hospital-token`,{
                    method:'GET',
                    headers:{
                        'Authorization':`Bearer ${token}`,
                    }
                });
                if (!response.ok) {
                    throw new Error('Token is invalid')
                }
                const data = (await response).json();
                console.log('Token is valid', data);
            } catch (error) {
                console.log(error);
                localStorage.removeItem('hospital_token');
                // Notify Navbar of login status change
                window.dispatchEvent(new Event('loginStatusChanged'));
                router.push('/hospital-login');
                alert("Unauthorized: Hospital not Logged In")
            }
        }
        checkToken();
    },[router]);

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target;

        // Fields to force lowercase
        const lowercaseFields = ['mediconnect_username', 'first_name', 'middle_name', 'last_name', 'portal_username'];

        // If the field is driver_license_id, allow only numbers
        if (name === 'driver_license_id') {
            // Remove non-digit characters
            const numericValue = value.replace(/\D/g, '');
            setForm({ ...form, [name]: numericValue });
            return;
        }

        setForm({
            ...form,
            [name]: type === 'checkbox' ? checked :
                    lowercaseFields.includes(name) ? value.toLowerCase() :
                    value
        });
    };

    const handleNextStep = async(e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Step 1: Register basic patient information
            const res = await fetch(`${API_BASE}/register`,{
                method:'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(form)
            });
            
            if (res.ok) {
                const data = await res.json();
                setSessionId(data.session_id);
                setStep(2); // Move to FHIR connection step
            } else {
                const errorData = await res.json();
                if (res.status === 409) {
                    setError("Registration Failed: " + errorData.detail);
                } else {
                    setError("Error during Registration: " + (errorData.detail || "Unknown error"));
                }
            }
        } catch (error) {
            console.error("Registration error:", error);
            setError("Network error during registration. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleConnectFHIR = async () => {
        setLoading(true);
        setError('');

        try {
            // Initiate FHIR OAuth login
            const res = await fetch(`${API_BASE}/fhir-login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    patient_username: form.mediconnect_username
                })
            });

            if (res.ok) {
                const data = await res.json();
                const fhirSessionId = data.session_id;
                const redirectUrl = data.redirect_url;

                // Store session info in localStorage for callback handling
                localStorage.setItem('fhir_session_id', fhirSessionId);
                localStorage.setItem('mediconnect_username', form.mediconnect_username);

                // Redirect to Epic login
                window.location.href = redirectUrl;
            } else {
                const errorData = await res.json();
                setError("FHIR connection failed: " + (errorData.detail || "Unknown error"));
            }
        } catch (error) {
            console.error("FHIR connection error:", error);
            setError("Network error connecting to healthcare provider. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSkipFHIR = async () => {
        try {
            await fetch(`${API_BASE}/patient/skip-fhir`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    mediconnect_username: form.mediconnect_username
                })
            });
            alert("Registration completed without healthcare provider connection. You can connect later from your profile.");
            router.push('/');
        } catch (error) {
            console.error("Skip FHIR error:", error);
            setError("Error completing registration. Please try again.");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && step === 1) {
            handleNextStep(e as any);
        }
    };

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
                maxWidth: '800px',
                width: '100%',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
            }}>
                <h1 style={{ 
                    textAlign: 'center', 
                    marginBottom: '1rem',
                    color: '#1a365d',
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    letterSpacing: '-0.025em',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                    Patient Registration
                </h1>

                {/* Progress Indicator */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '3rem'
                }}>
                    <div style={{
                        padding: '0.5rem 1.5rem',
                        borderRadius: '20px',
                        backgroundColor: step === 1 ? '#3b82f6' : '#10b981',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '0.9rem'
                    }}>
                        {step === 1 ? '1. Basic Information' : 'Basic Information'}
                    </div>
                    <div style={{
                        width: '50px',
                        height: '3px',
                        backgroundColor: step === 2 ? '#3b82f6' : '#e5e7eb'
                    }}/>
                    <div style={{
                        padding: '0.5rem 1.5rem',
                        borderRadius: '20px',
                        backgroundColor: step === 2 ? '#3b82f6' : '#e5e7eb',
                        color: step === 2 ? 'white' : '#6b7280',
                        fontWeight: '600',
                        fontSize: '0.9rem'
                    }}>
                        2. Connect Healthcare Provider
                    </div>
                </div>
                
                {step === 1 ? (
                <form onSubmit={handleNextStep} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Personal Information Section */}
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
                            Personal Information
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '0.75rem',
                                    color: '#374151',
                                    fontWeight: '600',
                                    fontSize: '0.95rem',
                                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                }}>
                                    First Name *
                                </label>
                                <input
                                    type="text"
                                    name="first_name"
                                    value={form.first_name}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    required
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
                                    Middle Name
                                </label>
                                <input
                                    type="text"
                                    name="middle_name"
                                    value={form.middle_name}
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
                                    placeholder="Enter middle name (optional)"
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
                                    Last Name *
                                </label>
                                <input
                                    type="text"
                                    name="last_name"
                                    value={form.last_name}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    required
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
                                    Driver License ID *
                                </label>
                                <input
                                    type="text"
                                    name="driver_license_id"
                                    value={form.driver_license_id}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    required
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
                                    placeholder="Enter driver license ID (numbers only)"
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

                    {/* MediConnect Account Section */}
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
                            MediConnect Account
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '0.75rem',
                                    color: '#374151',
                                    fontWeight: '600',
                                    fontSize: '0.95rem',
                                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                }}>
                                    MediConnect Username *
                                </label>
                                <input
                                    type="text"
                                    name="mediconnect_username"
                                    value={form.mediconnect_username}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    required
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
                                    placeholder="Choose username"
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
                                    Password *
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    onKeyDown={handleKeyDown}
                                    required
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
                                    placeholder="Create password"
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
                            Biometric Authentication (Optional)
                        </h3>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                color: '#374151',
                                fontWeight: '600',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                            }}>
                                <input
                                    type="checkbox"
                                    name="use_fingerprint"
                                    checked={form.use_fingerprint}
                                    onChange={handleChange}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        accentColor: '#8b5cf6',
                                        borderRadius: '4px'
                                    }}
                                />
                                Enable Fingerprint Login
                            </label>
                        </div>

                        {form.use_fingerprint && (
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
                                    value={form.fingerprint_data}
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
                                    placeholder="Enter fingerprint data"
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#8b5cf6';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#e5e7eb';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                            </div>
                        )}
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
                        disabled={loading}
                        style={{
                            padding: '1.25rem 2rem',
                            backgroundColor: loading ? '#9ca3af' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: loading ? 'none' : '0 10px 25px rgba(16, 185, 129, 0.3)',
                            transform: loading ? 'none' : 'translateY(0px)',
                            marginTop: '1rem'
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) {
                                e.currentTarget.style.backgroundColor = '#059669';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 15px 35px rgba(16, 185, 129, 0.4)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) {
                                e.currentTarget.style.backgroundColor = '#10b981';
                                e.currentTarget.style.transform = 'translateY(0px)';
                                e.currentTarget.style.boxShadow = '0 10px 25px rgba(16, 185, 129, 0.3)';
                            }
                        }}
                    >
                        {loading ? 'Creating Account...' : 'Next: Connect Healthcare Provider'}
                    </button>
                </form>
                ) : (
                    // Step 2: FHIR Connection
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            padding: '3rem',
                            borderRadius: '24px',
                            border: '2px solid #e5e7eb',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
                            textAlign: 'center'
                        }}>
                            <div style={{ 
                                fontSize: '4rem', 
                                marginBottom: '1.5rem'
                            }}>
                            </div>
                            
                            <h3 style={{ 
                                color: '#1e40af', 
                                marginBottom: '1rem',
                                fontSize: '2rem',
                                fontWeight: '700',
                                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                            }}>
                                Connect Your Healthcare Provider
                            </h3>
                            
                            <p style={{
                                color: '#6b7280',
                                fontSize: '1.1rem',
                                lineHeight: '1.8',
                                marginBottom: '2rem',
                                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                            }}>
                                Connect your healthcare provider account (Epic MyChart, Kaiser, UCSF, etc.) 
                                to automatically import your medical records into MediConnect.
                            </p>

                            <div style={{
                                backgroundColor: '#f0f9ff',
                                padding: '1.5rem',
                                borderRadius: '16px',
                                marginBottom: '2rem',
                                textAlign: 'left'
                            }}>
                                <h4 style={{ 
                                    color: '#1e40af',
                                    marginBottom: '1rem',
                                    fontWeight: '600',
                                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                }}>
                                    What happens next:
                                </h4>
                                <ul style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    color: '#374151',
                                    fontSize: '0.95rem',
                                    lineHeight: '2',
                                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                }}>
                                    <li>You'll be redirected to your healthcare provider's login page</li>
                                    <li>Sign in with your existing patient portal credentials</li>
                                    <li>Authorize MediConnect to access your medical records</li>
                                    <li>Your data will be securely imported and encrypted</li>
                                </ul>
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
                                    marginBottom: '2rem',
                                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ 
                                display: 'flex', 
                                gap: '1rem',
                                justifyContent: 'center',
                                flexWrap: 'wrap'
                            }}>
                                <button
                                    onClick={handleConnectFHIR}
                                    disabled={loading}
                                    style={{
                                        padding: '1.25rem 2.5rem',
                                        backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '16px',
                                        fontSize: '1.1rem',
                                        fontWeight: '600',
                                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: loading ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!loading) {
                                            e.currentTarget.style.backgroundColor = '#2563eb';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 15px 35px rgba(59, 130, 246, 0.4)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!loading) {
                                            e.currentTarget.style.backgroundColor = '#3b82f6';
                                            e.currentTarget.style.transform = 'translateY(0px)';
                                            e.currentTarget.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)';
                                        }
                                    }}
                                >
                                    {loading ? 'Connecting...' : 'Connect Provider'}
                                </button>

                                <button
                                    onClick={handleSkipFHIR}
                                    disabled={loading}
                                    style={{
                                        padding: '1.25rem 2.5rem',
                                        backgroundColor: 'transparent',
                                        color: '#6b7280',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '16px',
                                        fontSize: '1.1rem',
                                        fontWeight: '600',
                                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!loading) {
                                            e.currentTarget.style.borderColor = '#9ca3af';
                                            e.currentTarget.style.color = '#374151';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!loading) {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.color = '#6b7280';
                                        }
                                    }}
                                >
                                    Skip for Now
                                </button>
                            </div>
                        </div>

                        <div style={{
                            padding: '1.25rem',
                            backgroundColor: '#fef3c7',
                            borderRadius: '20px',
                            border: '2px solid #fde047'
                        }}>
                            <p style={{ 
                                margin: 0,
                                color: '#92400e',
                                fontSize: '0.9rem',
                                lineHeight: '1.6',
                                fontWeight: '500',
                                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                            }}>
                                <strong>Note:</strong> You can skip this step and connect your healthcare provider later from your profile settings. 
                                However, connecting now ensures EMTs have immediate access to your medical history in emergencies.
                            </p>
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div style={{
                        marginTop: '2rem',
                        padding: '1.25rem',
                        backgroundColor: '#f0f9ff',
                        borderRadius: '20px',
                        border: '2px solid #bae6fd'
                    }}>
                        <p style={{ 
                            margin: 0,
                            color: '#0c4a6e',
                            fontSize: '0.9rem',
                            lineHeight: '1.6',
                            fontWeight: '500',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                        }}>
                            <strong>Patient Registration:</strong> Please fill out all required fields (*) to create your MediConnect account. 
                            After this step, you'll connect your healthcare provider to import your medical records.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}