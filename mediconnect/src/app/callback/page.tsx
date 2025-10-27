'use client'

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';

export default function FHIRCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('processing');
    const [message, setMessage] = useState('Processing your healthcare provider connection...');
    const [error, setError] = useState('');

    useEffect(() => {
        const handleCallback = async () => {
            // Get callback parameters from URL
            // Backend redirects here after handling Epic's OAuth callback
            const sessionIdParam = searchParams.get('session_id');
            const patientIdParam = searchParams.get('patient_id');
            const statusParam = searchParams.get('status');
            
            // Get stored session info from localStorage
            const fhirSessionId = localStorage.getItem('fhir_session_id');
            const mediconnectUsername = localStorage.getItem('mediconnect_username');

            // Check if we have all required data
            if (!sessionIdParam && !fhirSessionId) {
                setStatus('error');
                setError('Missing session ID. Please try registering again.');
                return;
            }

            if (!mediconnectUsername) {
                setStatus('error');
                setError('Missing username. Please try registering again.');
                return;
            }

            try {
                // Use session_id from URL (provided by backend after OAuth exchange)
                const actualSessionId = sessionIdParam || fhirSessionId;

                setMessage('Fetching your medical records...');

                // Link FHIR data to patient record
                const linkRes = await fetch(`${API_BASE}/patient/link-fhir`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        mediconnect_username: mediconnectUsername,
                        fhir_session_id: actualSessionId
                    })
                });

                if (!linkRes.ok) {
                    const errorData = await linkRes.json();
                    throw new Error(errorData.detail || 'Failed to link FHIR data');
                }

                const linkData = await linkRes.json();
                console.log('FHIR data linked:', linkData);

                // Clear FHIR session data
                localStorage.removeItem('fhir_session_id');
                // Keep mediconnect_username for next page

                setStatus('success');
                setMessage(`Successfully connected to ${linkData.provider_name}! Imported ${linkData.data_summary.allergies} allergies, ${linkData.data_summary.conditions} conditions, ${linkData.data_summary.medications} medications, and more.`);

                // Redirect to complete profile page after 2 seconds
                setTimeout(() => {
                    router.push(`/complete-profile?username=${mediconnectUsername}`);
                }, 2000);

            } catch (err: any) {
                console.error('FHIR callback error:', err);
                setStatus('error');
                setError(err.message || 'An unexpected error occurred');
                
                // Clear stored session data even on error
                localStorage.removeItem('fhir_session_id');
                localStorage.removeItem('mediconnect_username');
            }
        };

        handleCallback();
    }, [searchParams, router]);

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '2rem',
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
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
                textAlign: 'center'
            }}>
                {status === 'processing' && (
                    <>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            margin: '0 auto 1.5rem',
                            position: 'relative'
                        }}>
                            <svg 
                                style={{
                                    animation: 'spin 1s linear infinite',
                                    width: '100%',
                                    height: '100%'
                                }}
                                viewBox="0 0 50 50"
                            >
                                <circle
                                    cx="25"
                                    cy="25"
                                    r="20"
                                    fill="none"
                                    stroke="#667eea"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray="31.4 31.4"
                                    transform="rotate(-90 25 25)"
                                />
                            </svg>
                        </div>
                        <h1 style={{ 
                            color: '#1a365d',
                            fontSize: '2rem',
                            fontWeight: '700',
                            marginBottom: '1rem'
                        }}>
                            Connecting Your Healthcare Provider
                        </h1>
                        <p style={{
                            color: '#6b7280',
                            fontSize: '1.1rem',
                            lineHeight: '1.8'
                        }}>
                            {message}
                        </p>
                        <div style={{
                            marginTop: '2rem',
                            padding: '1rem',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '16px',
                            border: '2px solid #bae6fd'
                        }}>
                            <p style={{
                                margin: 0,
                                color: '#0c4a6e',
                                fontSize: '0.9rem',
                                fontWeight: '500'
                            }}>
                                Please wait while we securely import your medical records...
                            </p>
                        </div>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            margin: '0 auto 1.5rem',
                            position: 'relative'
                        }}>
                            <svg
                                viewBox="0 0 52 52"
                                style={{
                                    width: '100%',
                                    height: '100%'
                                }}
                            >
                                <circle
                                    cx="26"
                                    cy="26"
                                    r="25"
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2"
                                />
                                <path
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M14 27l7 7 16-16"
                                    style={{
                                        strokeDasharray: 48,
                                        strokeDashoffset: 48,
                                        animation: 'checkmark 0.5s ease-in-out 0.1s forwards'
                                    }}
                                />
                            </svg>
                        </div>
                        <h1 style={{ 
                            color: '#059669',
                            fontSize: '2rem',
                            fontWeight: '700',
                            marginBottom: '1rem'
                        }}>
                            Connection Successful!
                        </h1>
                        <p style={{
                            color: '#374151',
                            fontSize: '1.1rem',
                            lineHeight: '1.8',
                            marginBottom: '1.5rem'
                        }}>
                            {message}
                        </p>
                        <div style={{
                            padding: '1rem',
                            backgroundColor: '#d1fae5',
                            borderRadius: '16px',
                            border: '2px solid #6ee7b7'
                        }}>
                            <p style={{
                                margin: 0,
                                color: '#065f46',
                                fontSize: '0.9rem',
                                fontWeight: '500'
                            }}>
                                Redirecting you to the dashboard...
                            </p>
                        </div>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div style={{
                            fontSize: '4rem',
                            marginBottom: '1.5rem'
                        }}>
                            ❌
                        </div>
                        <h1 style={{ 
                            color: '#dc2626',
                            fontSize: '2rem',
                            fontWeight: '700',
                            marginBottom: '1rem'
                        }}>
                            Connection Failed
                        </h1>
                        <p style={{
                            color: '#374151',
                            fontSize: '1.1rem',
                            lineHeight: '1.8',
                            marginBottom: '1.5rem'
                        }}>
                            {error}
                        </p>
                        <div style={{
                            padding: '1rem',
                            backgroundColor: '#fef2f2',
                            borderRadius: '16px',
                            border: '2px solid #fecaca',
                            marginBottom: '2rem'
                        }}>
                            <p style={{
                                margin: 0,
                                color: '#991b1b',
                                fontSize: '0.9rem',
                                fontWeight: '500'
                            }}>
                                You can try connecting your healthcare provider later from your profile settings.
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/')}
                            style={{
                                padding: '1rem 2rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#3b82f6';
                            }}
                        >
                            Return to Home
                        </button>
                    </>
                )}
            </div>

            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes checkmark {
                    to {
                        stroke-dashoffset: 0;
                    }
                }
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.8;
                    }
                }
            `}</style>
        </div>
    );
}
