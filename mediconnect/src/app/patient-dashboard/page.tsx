'use client'

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';

interface PatientData {
    mediconnect_username: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    address_line1?: string;
    city?: string;
    state?: string;
    date_of_birth?: string;
    blood_type?: string;
    fhir_connected: boolean;
    provider_name?: string;
    fhir_data?: any;
    medical_data_summary?: {
        allergies_count: number;
        conditions_count: number;
        medications_count: number;
        observations_count: number;
        procedures_count: number;
        immunizations_count: number;
    };
}

export default function PatientDashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [patient, setPatient] = useState<PatientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const username = searchParams.get('username') || localStorage.getItem('mediconnect_username');
        
        if (!username) {
            router.push('/patient-login');
            return;
        }

        fetchPatientData(username);
    }, []);

    const fetchPatientData = async (username: string) => {
        try {
            const response = await fetch(`${API_BASE}/patient/profile/${username}`);
            
            if (response.ok) {
                const data = await response.json();
                setPatient(data);
            } else {
                alert('Failed to load patient data');
                router.push('/patient-login');
            }
        } catch (error) {
            console.error('Error fetching patient data:', error);
            alert('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('mediconnect_username');
        localStorage.removeItem('patient_token');
        router.push('/');
    };

    if (loading) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <div style={{ color: 'white', fontSize: '1.5rem' }}>Loading...</div>
            </div>
        );
    }

    if (!patient) {
        return null;
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#f3f4f6',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '2rem',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                                Welcome, {patient.first_name} {patient.last_name}
                            </h1>
                            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
                                {patient.fhir_connected 
                                    ? `✅ Connected to ${patient.provider_name}` 
                                    : '⚠️ No healthcare provider connected'}
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                border: '2px solid white',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 2rem' }}>
                {/* Tab Navigation */}
                <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    marginBottom: '2rem',
                    borderBottom: '2px solid #e5e7eb'
                }}>
                    {['overview', 'allergies', 'conditions', 'medications', 'procedures', 'immunizations', 'profile'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '1rem 1.5rem',
                                backgroundColor: 'transparent',
                                color: activeTab === tab ? '#3b82f6' : '#6b7280',
                                border: 'none',
                                borderBottom: activeTab === tab ? '3px solid #3b82f6' : '3px solid transparent',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            {patient.fhir_connected && patient.medical_data_summary && (
                                <>
                                    <StatCard icon="🤧" title="Allergies" count={patient.medical_data_summary.allergies_count} color="#ef4444" />
                                    <StatCard icon="🏥" title="Conditions" count={patient.medical_data_summary.conditions_count} color="#f59e0b" />
                                    <StatCard icon="💊" title="Medications" count={patient.medical_data_summary.medications_count} color="#10b981" />
                                    <StatCard icon="🔬" title="Observations" count={patient.medical_data_summary.observations_count} color="#3b82f6" />
                                    <StatCard icon="⚕️" title="Procedures" count={patient.medical_data_summary.procedures_count} color="#8b5cf6" />
                                    <StatCard icon="💉" title="Immunizations" count={patient.medical_data_summary.immunizations_count} color="#ec4899" />
                                </>
                            )}
                        </div>

                        {!patient.fhir_connected && (
                            <div style={{
                                backgroundColor: '#fff3cd',
                                border: '2px solid #ffc107',
                                borderRadius: '12px',
                                padding: '2rem',
                                textAlign: 'center'
                            }}>
                                <h2 style={{ color: '#856404', fontSize: '1.5rem', marginBottom: '1rem' }}>
                                    No Healthcare Provider Connected
                                </h2>
                                <p style={{ color: '#856404', marginBottom: '1.5rem' }}>
                                    Connect your healthcare provider to import your medical records automatically.
                                </p>
                                <button style={{
                                    padding: '1rem 2rem',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}>
                                    Connect Healthcare Provider
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Allergies Tab */}
                {activeTab === 'allergies' && (
                    <MedicalRecordsSection
                        title="Allergies & Intolerances"
                        icon="🤧"
                        data={patient.fhir_data?.allergies?.entry || []}
                        emptyMessage="No allergies recorded"
                    />
                )}

                {/* Conditions Tab */}
                {activeTab === 'conditions' && (
                    <MedicalRecordsSection
                        title="Medical Conditions"
                        icon="🏥"
                        data={patient.fhir_data?.conditions?.entry || []}
                        emptyMessage="No conditions recorded"
                    />
                )}

                {/* Medications Tab */}
                {activeTab === 'medications' && (
                    <MedicalRecordsSection
                        title="Medications"
                        icon="💊"
                        data={patient.fhir_data?.medications?.entry || []}
                        emptyMessage="No medications recorded"
                    />
                )}

                {/* Procedures Tab */}
                {activeTab === 'procedures' && (
                    <MedicalRecordsSection
                        title="Procedures"
                        icon="⚕️"
                        data={patient.fhir_data?.procedures?.entry || []}
                        emptyMessage="No procedures recorded"
                    />
                )}

                {/* Immunizations Tab */}
                {activeTab === 'immunizations' && (
                    <MedicalRecordsSection
                        title="Immunizations"
                        icon="💉"
                        data={patient.fhir_data?.immunizations?.entry || []}
                        emptyMessage="No immunizations recorded"
                    />
                )}

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <ProfileSection patient={patient} />
                )}
            </div>
        </div>
    );
}

function StatCard({ icon, title, count, color }: { icon: string, title: string, count: number, color: string }) {
    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            borderLeft: `4px solid ${color}`
        }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color, marginBottom: '0.25rem' }}>
                {count}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem', fontWeight: '500' }}>
                {title}
            </div>
        </div>
    );
}

function MedicalRecordsSection({ title, icon, data, emptyMessage }: any) {
    return (
        <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>
                {icon} {title}
            </h2>
            
            {data.length === 0 ? (
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#9ca3af'
                }}>
                    {emptyMessage}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {data.map((entry: any, index: number) => (
                        <div
                            key={index}
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                        >
                            <pre style={{ 
                                whiteSpace: 'pre-wrap', 
                                fontSize: '0.9rem',
                                color: '#374151'
                            }}>
                                {JSON.stringify(entry.resource, null, 2)}
                            </pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ProfileSection({ patient }: { patient: PatientData }) {
    return (
        <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>
                👤 Profile Information
            </h2>
            
            <div style={{ display: 'grid', gap: '2rem' }}>
                {/* Personal Information */}
                <InfoCard title="Personal Information" icon="👤">
                    <InfoRow label="Full Name" value={`${patient.first_name} ${patient.middle_name} ${patient.last_name}`} />
                    <InfoRow label="Date of Birth" value={patient.date_of_birth || 'Not provided'} />
                    <InfoRow label="Blood Type" value={patient.blood_type || 'Not provided'} />
                </InfoCard>

                {/* Contact Information */}
                <InfoCard title="Contact Information" icon="📞">
                    <InfoRow label="Email" value={patient.email || 'Not provided'} />
                    <InfoRow label="Phone" value={patient.phone || 'Not provided'} />
                    <InfoRow label="Address" value={patient.address_line1 ? `${patient.address_line1}, ${patient.city}, ${patient.state}` : 'Not provided'} />
                </InfoCard>

                {/* Healthcare Provider */}
                {patient.fhir_connected && (
                    <InfoCard title="Healthcare Provider" icon="🏥">
                        <InfoRow label="Provider" value={patient.provider_name || 'Unknown'} />
                        <InfoRow label="Status" value="✅ Connected" />
                    </InfoCard>
                )}
            </div>
        </div>
    );
}

function InfoCard({ title, icon, children }: any) {
    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#374151' }}>
                {icon} {title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {children}
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ color: '#6b7280', fontWeight: '500' }}>{label}:</span>
            <span style={{ color: '#1f2937', fontWeight: '600' }}>{value}</span>
        </div>
    );
}
