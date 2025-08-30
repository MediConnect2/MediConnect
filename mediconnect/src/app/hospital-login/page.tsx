'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HospitalLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() =>{
        const checkToken = async () => {
            const token = localStorage.getItem('hospital_token');
            try{
                const response = await fetch('http://localhost:8000/verify-hospital-token', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    }
                });
                if (!response.ok) {
                    localStorage.removeItem('hospital_token');
                    throw new Error('Token is invalid');
                }
                const data = await response.json();
                console.log('Token is valid: pushing to /patient-register', data);
                router.push('/patient-register');
            } catch (error) {
                console.log(error);
                localStorage.removeItem('hospital_token');
                router.push('/hospital-login');
            }
        }
        checkToken();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:8000/hospital/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.toLowerCase(), password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Login failed');
            }

            const data = await response.json();
            localStorage.setItem('hospital_token', data['access_token']);
            alert('Login successful! Signed in with ' + data.name);
            router.push('/patient-register');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleLogin(e as any);
        }
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            paddingTop: '120px',
            padding: '2rem',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
            <div style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                padding: '3rem', 
                borderRadius: '32px',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
            }}>
                <h1 style={{ 
                    textAlign: 'center', 
                    marginBottom: '2.5rem',
                    color: '#1a365d',
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    letterSpacing: '-0.025em',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                    Hospital Login
                </h1>
                
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ 
                            display: 'block', 
                            marginBottom: '0.75rem',
                            color: '#374151',
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                        }}>
                            Hospital Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value.toLowerCase())}
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
                            placeholder="Enter hospital username"
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
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
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
                            placeholder="Enter your password"
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
                            padding: '1rem 2rem',
                            backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: loading ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.3)',
                            transform: loading ? 'none' : 'translateY(0px)'
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
                        {loading ? 'Logging in...' : 'Login to Hospital Portal'}
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
                        <strong>Hospital Access:</strong> Please provide your hospital credentials to access the patient registration system and manage hospital operations.
                    </p>
                </div>
            </div>
        </div>
    );
}
