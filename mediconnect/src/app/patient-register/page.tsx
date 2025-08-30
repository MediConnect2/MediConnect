'use client'

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PatientRegisterPage(){
    const router = useRouter();
    const [form,setForm] = useState({
        mediconnect_username:'',
        password:'',
        first_name:'',
        middle_name:'',
        last_name:'',
        driver_license_id:'',
        portal_username:'',
        portal_password:'',
        provider_portal_name:'',
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
                const response = await fetch('http://localhost:8000/verify-hospital-token',{
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

    const handleSubmit = async(e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('http://localhost:8000/register',{
                method:'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(form)
            });
            
            if (res.ok) { 
                alert("Patient Registered Successfully! Welcome " + form.first_name + " " + form.last_name);
                // Reset form after successful registration
                setForm({
                    mediconnect_username:'',
                    password:'',
                    first_name:'',
                    middle_name:'',
                    last_name:'',
                    driver_license_id:'',
                    portal_username:'',
                    portal_password:'',
                    provider_portal_name:'',
                    use_fingerprint: false,
                    fingerprint_data: ''
                });
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit(e as any);
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
                    marginBottom: '3rem',
                    color: '#1a365d',
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    letterSpacing: '-0.025em',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                    Patient Registration
                </h1>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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

                    {/* Healthcare Portal Section */}
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
                            paddingBottom: '0.75rem',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                        }}>
                            Healthcare Portal Information
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
                                    Provider Portal Name *
                                </label>
                                <input
                                    type="text"
                                    name="provider_portal_name"
                                    value={form.provider_portal_name}
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
                                    placeholder="e.g., Kaiser Permanente, UCSF MyChart"
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#f59e0b';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.1)';
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
                                    Portal Username *
                                </label>
                                <input
                                    type="text"
                                    name="portal_username"
                                    value={form.portal_username}
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
                                    placeholder="Your portal username"
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#f59e0b';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#e5e7eb';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ 
                                    display: 'block', 
                                    marginBottom: '0.75rem',
                                    color: '#374151',
                                    fontWeight: '600',
                                    fontSize: '0.95rem',
                                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                }}>
                                    Portal Password *
                                </label>
                                <input
                                    type="password"
                                    name="portal_password"
                                    value={form.portal_password}
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
                                    placeholder="Your portal password"
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#f59e0b';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.1)';
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
                        {loading ? 'Registering Patient...' : 'Register Patient'}
                    </button>
                </form>

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
                        <strong>Patient Registration:</strong> Please fill out all required fields (*) to register a new patient. This information will be securely encrypted and stored for emergency medical access.
                    </p>
                </div>
            </div>
        </div>
    );
}