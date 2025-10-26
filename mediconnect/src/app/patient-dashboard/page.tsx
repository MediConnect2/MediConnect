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
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    fhir_connected: boolean;
    provider_name?: string;
    fhir_data?: any;
    manual_allergies?: string;
    manual_conditions?: string;
    manual_medications?: string;
    manual_procedures?: string;
    manual_immunizations?: string;
    medical_data_summary?: {
        allergies_count: number;
        conditions_count: number;
        medications_count: number;
        observations_count: number;
        procedures_count: number;
        immunizations_count: number;
        has_manual_allergies?: boolean;
        has_manual_conditions?: boolean;
        has_manual_medications?: boolean;
        has_manual_procedures?: boolean;
        has_manual_immunizations?: boolean;
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
                console.log('Patient data received:', data);
                console.log('Manual allergies:', data.manual_allergies);
                console.log('Manual conditions:', data.manual_conditions);
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
                    <OverviewSection patient={patient} onNavigate={setActiveTab} />
                )}

                {/* Allergies Tab */}
                {activeTab === 'allergies' && (
                    <AllergiesSection 
                        fhirAllergies={patient.fhir_data?.allergies?.entry || []}
                        manualAllergies={patient.manual_allergies}
                    />
                )}

                {/* Conditions Tab */}
                {activeTab === 'conditions' && (
                    <MedicalRecordsSection
                        title="Medical Conditions"
                        data={patient.fhir_data?.conditions?.entry || []}
                        manualData={patient.manual_conditions}
                        emptyMessage="No conditions recorded"
                    />
                )}

                {/* Medications Tab */}
                {activeTab === 'medications' && (
                    <MedicalRecordsSection
                        title="Medications"
                        data={patient.fhir_data?.medications?.entry || []}
                        manualData={patient.manual_medications}
                        emptyMessage="No medications recorded"
                    />
                )}

                {/* Procedures Tab */}
                {activeTab === 'procedures' && (
                    <MedicalRecordsSection
                        title="Procedures"
                        data={patient.fhir_data?.procedures?.entry || []}
                        manualData={patient.manual_procedures}
                        emptyMessage="No procedures recorded"
                    />
                )}

                {/* Immunizations Tab */}
                {activeTab === 'immunizations' && (
                    <MedicalRecordsSection
                        title="Immunizations"
                        data={patient.fhir_data?.immunizations?.entry || []}
                        manualData={patient.manual_immunizations}
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

function StatCard({ title, count, color, hasSelfReported, onClick }: { title: string, count: number, color: string, hasSelfReported?: boolean, onClick?: () => void }) {
    return (
        <div 
            onClick={onClick}
            style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                borderLeft: `4px solid ${color}`,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                transform: 'scale(1)'
            }}
            onMouseEnter={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                }
            }}
            onMouseLeave={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }
            }}
        >
            <div style={{ fontSize: '2rem', fontWeight: '700', color, marginBottom: '0.25rem' }}>
                {count}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.9rem', fontWeight: '500', marginBottom: hasSelfReported ? '0.5rem' : '0' }}>
                {title}
            </div>
            {hasSelfReported && (
                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#92400e',
                    backgroundColor: '#fef3c7',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    display: 'inline-block',
                    marginTop: '0.25rem'
                }}>
                    Self-Reported
                </div>
            )}
        </div>
    );
}

function OverviewSection({ patient, onNavigate }: { patient: PatientData, onNavigate?: (tab: string) => void }) {
    // Extract valid allergies from FHIR data
    const fhirAllergies = (patient.fhir_data?.allergies?.entry || []).filter((entry: any) => {
        if (entry.resource?.resourceType === 'OperationOutcome') return false;
        if (entry.resource?.code?.coding?.[0]?.code === '1631000175102') return false; // "Patient not asked"
        return true;
    });

    const hasManualData = patient.manual_allergies || patient.manual_conditions || 
                          patient.manual_medications || patient.manual_procedures || 
                          patient.manual_immunizations;

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleCardClick = (section: string, sectionId?: string) => {
        if (sectionId) {
            // Section is on overview, just scroll
            scrollToSection(sectionId);
        } else if (onNavigate) {
            // Section is on a different tab, navigate there
            onNavigate(section);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Critical Information Banner */}
            <div style={{
                backgroundColor: '#fee2e2',
                border: '3px solid #dc2626',
                borderRadius: '12px',
                padding: '1.5rem'
            }}>
                <h2 style={{ color: '#991b1b', fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>
                    CRITICAL PATIENT INFORMATION
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <CriticalInfo label="Blood Type" value={patient.blood_type || 'Unknown'} />
                    <CriticalInfo label="Date of Birth" value={patient.date_of_birth || 'Unknown'} />
                    <CriticalInfo label="Emergency Contact" value={patient.emergency_contact_phone || 'Not provided'} />
                </div>
            </div>

            {/* Data Source Notice */}
            {hasManualData && (
                <div style={{
                    backgroundColor: '#fef3c7',
                    border: '2px solid #f59e0b',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}>
                    <div>
                        <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '0.25rem' }}>
                            Patient-Reported Data Present
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#78350f' }}>
                            Some medical information was manually entered by the patient and may not be verified by a healthcare provider.
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            {patient.fhir_connected && patient.medical_data_summary && (
                <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
                        Medical Records Summary
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                        <StatCard 
                            title="Allergies" 
                            count={patient.medical_data_summary.allergies_count} 
                            color="#ef4444" 
                            hasSelfReported={patient.medical_data_summary.has_manual_allergies}
                            onClick={() => handleCardClick('allergies', 'allergies-section')}
                        />
                        <StatCard 
                            title="Conditions" 
                            count={patient.medical_data_summary.conditions_count} 
                            color="#f59e0b" 
                            hasSelfReported={patient.medical_data_summary.has_manual_conditions}
                            onClick={() => handleCardClick('conditions', 'conditions-section')}
                        />
                        <StatCard 
                            title="Medications" 
                            count={patient.medical_data_summary.medications_count} 
                            color="#10b981" 
                            hasSelfReported={patient.medical_data_summary.has_manual_medications}
                            onClick={() => handleCardClick('medications', 'medications-section')}
                        />
                        <StatCard 
                            title="Observations" 
                            count={patient.medical_data_summary.observations_count} 
                            color="#3b82f6" 
                        />
                        <StatCard 
                            title="Procedures" 
                            count={patient.medical_data_summary.procedures_count} 
                            color="#8b5cf6" 
                            hasSelfReported={patient.medical_data_summary.has_manual_procedures}
                            onClick={() => handleCardClick('procedures')}
                        />
                        <StatCard 
                            title="Immunizations" 
                            count={patient.medical_data_summary.immunizations_count} 
                            color="#ec4899" 
                            hasSelfReported={patient.medical_data_summary.has_manual_immunizations}
                            onClick={() => handleCardClick('immunizations')}
                        />
                    </div>
                </div>
            )}

            {/* Allergies Display - CRITICAL for EMTs */}
            <div id="allergies-section">
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ALLERGIES & INTOLERANCES
                </h3>
                
                {fhirAllergies.length === 0 && !patient.manual_allergies ? (
                    <div style={{
                        backgroundColor: '#f0fdf4',
                        border: '2px solid #22c55e',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        color: '#166534',
                        fontWeight: '600'
                    }}>
                        No known allergies recorded
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* FHIR Allergies */}
                        {fhirAllergies.map((entry: any, index: number) => {
                            const resource = entry.resource;
                            const allergen = resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown allergen';
                            const severity = resource.reaction?.[0]?.severity;
                            const manifestation = resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || 
                                                resource.reaction?.[0]?.manifestation?.[0]?.text;
                            const category = resource.category?.[0];

                            return (
                                <div
                                    key={`fhir-allergy-${index}`}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '12px',
                                        padding: '1.25rem',
                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                        borderLeft: `5px solid ${severity === 'severe' ? '#dc2626' : severity === 'moderate' ? '#f59e0b' : '#3b82f6'}`,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'start'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                                            {allergen.toUpperCase()}
                                        </div>
                                        {category && (
                                            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                                                Category: {category}
                                            </div>
                                        )}
                                        {manifestation && (
                                            <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                                                <span style={{ fontWeight: '600' }}>Reaction:</span> {manifestation}
                                            </div>
                                        )}
                                    </div>
                                    {severity && (
                                        <span style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            backgroundColor: severity === 'severe' ? '#fee2e2' : severity === 'moderate' ? '#fef3c7' : '#dbeafe',
                                            color: severity === 'severe' ? '#991b1b' : severity === 'moderate' ? '#92400e' : '#1e40af',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {severity}
                                        </span>
                                    )}
                                </div>
                            );
                        })}

                        {/* Manual Allergies */}
                        {patient.manual_allergies && (
                            <div style={{
                                backgroundColor: '#fffbeb',
                                borderRadius: '12px',
                                padding: '1.25rem',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                borderLeft: '5px solid #f59e0b'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '1rem', fontWeight: '700', color: '#92400e' }}>
                                        PATIENT-REPORTED ALLERGIES
                                    </span>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.625rem',
                                        fontWeight: '700',
                                        backgroundColor: '#f59e0b',
                                        color: 'white'
                                    }}>
                                        UNVERIFIED
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.95rem', color: '#78350f', whiteSpace: 'pre-wrap', fontWeight: '500' }}>
                                    {patient.manual_allergies}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Current Medications Summary */}
            {(patient.fhir_data?.medications?.entry?.length > 0 || patient.manual_medications) && (
                <div id="medications-section">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#374151' }}>
                        Current Medications
                    </h3>
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {patient.fhir_data?.medications?.entry?.slice(0, 10).map((entry: any, index: number) => {
                                const med = entry.resource?.medicationCodeableConcept?.text || 
                                           entry.resource?.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown';
                                return (
                                    <span key={`med-${index}`} style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#e0f2fe',
                                        color: '#075985',
                                        borderRadius: '6px',
                                        fontSize: '0.875rem',
                                        fontWeight: '500'
                                    }}>
                                        {med}
                                    </span>
                                );
                            })}
                            {patient.manual_medications && (
                                <span style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    border: '2px solid #f59e0b'
                                }}>
                                    {patient.manual_medications} (Self-Reported)
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Medical Conditions Summary */}
            {(patient.fhir_data?.conditions?.entry?.length > 0 || patient.manual_conditions) && (
                <div id="conditions-section">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#374151' }}>
                        Medical Conditions
                    </h3>
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {patient.fhir_data?.conditions?.entry?.slice(0, 10).map((entry: any, index: number) => {
                                const condition = entry.resource?.code?.text || 
                                                entry.resource?.code?.coding?.[0]?.display || 'Unknown';
                                return (
                                    <span key={`cond-${index}`} style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#fef3c7',
                                        color: '#92400e',
                                        borderRadius: '6px',
                                        fontSize: '0.875rem',
                                        fontWeight: '500'
                                    }}>
                                        {condition}
                                    </span>
                                );
                            })}
                            {patient.manual_conditions && (
                                <span style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    border: '2px solid #f59e0b'
                                }}>
                                    {patient.manual_conditions} (Self-Reported)
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* No Provider Connected Warning */}
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
    );
}

function CriticalInfo({ label, value }: { label: string, value: string }) {
    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '1rem'
        }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#991b1b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                {label}
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
                {value}
            </div>
        </div>
    );
}

function MedicalRecordsSection({ title, data, manualData, emptyMessage }: any) {
    const hasData = data.length > 0 || manualData;
    
    return (
        <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>
                {title}
            </h2>
            
            {!hasData ? (
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* FHIR Data */}
                    {data.map((entry: any, index: number) => (
                        <div
                            key={`fhir-${index}`}
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
                    
                    {/* Manually Entered Data */}
                    {manualData && (
                        <div style={{
                            backgroundColor: '#fffbeb',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            borderLeft: '4px solid #f59e0b'
                        }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#92400e' }}>
                                    Patient-Reported {title}
                                </h3>
                            </div>
                            <div style={{ fontSize: '0.95rem', color: '#78350f', whiteSpace: 'pre-wrap' }}>
                                {manualData}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function AllergiesSection({ fhirAllergies, manualAllergies }: { fhirAllergies: any[], manualAllergies?: string }) {
    console.log('AllergiesSection - fhirAllergies:', fhirAllergies);
    console.log('AllergiesSection - manualAllergies:', manualAllergies);
    
    // Extract actual allergies from FHIR data (exclude "Patient not asked" or OperationOutcome)
    const validAllergies = fhirAllergies.filter((entry: any) => {
        if (entry.resource?.resourceType === 'OperationOutcome') return false;
        if (entry.resource?.code?.coding?.[0]?.code === '1631000175102') return false; // "Patient not asked"
        return true;
    });

    const hasData = validAllergies.length > 0 || manualAllergies;

    return (
        <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>
                Allergies & Intolerances
            </h2>

            {!hasData ? (
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#9ca3af'
                }}>
                    No allergies recorded
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* FHIR Allergies */}
                    {validAllergies.map((entry: any, index: number) => {
                        const resource = entry.resource;
                        const allergen = resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown allergen';
                        const clinicalStatus = resource.clinicalStatus?.coding?.[0]?.display || resource.clinicalStatus?.coding?.[0]?.code;
                        const verificationStatus = resource.verificationStatus?.coding?.[0]?.display || resource.verificationStatus?.coding?.[0]?.code;
                        const severity = resource.reaction?.[0]?.severity;
                        const manifestation = resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || 
                                            resource.reaction?.[0]?.manifestation?.[0]?.text;
                        const category = resource.category?.[0];

                        return (
                            <div
                                key={index}
                                style={{
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                    borderLeft: `4px solid ${severity === 'severe' ? '#dc2626' : severity === 'moderate' ? '#f59e0b' : '#3b82f6'}`
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                                            {allergen}
                                        </h3>
                                        {category && (
                                            <span style={{ 
                                                fontSize: '0.875rem', 
                                                color: '#6b7280',
                                                textTransform: 'capitalize'
                                            }}>
                                                {category}
                                            </span>
                                        )}
                                    </div>
                                    {severity && (
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            backgroundColor: severity === 'severe' ? '#fee2e2' : severity === 'moderate' ? '#fef3c7' : '#dbeafe',
                                            color: severity === 'severe' ? '#991b1b' : severity === 'moderate' ? '#92400e' : '#1e40af'
                                        }}>
                                            {severity}
                                        </span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {clinicalStatus && (
                                        <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                                            <span style={{ fontWeight: '500' }}>Status:</span> {clinicalStatus}
                                        </div>
                                    )}
                                    {verificationStatus && (
                                        <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                                            <span style={{ fontWeight: '500' }}>Verification:</span> {verificationStatus}
                                        </div>
                                    )}
                                    {manifestation && (
                                        <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                                            <span style={{ fontWeight: '500' }}>Reaction:</span> {manifestation}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Manually Inputted Allergies */}
                    {manualAllergies && (
                        <div style={{
                            backgroundColor: '#fffbeb',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            borderLeft: '4px solid #f59e0b'
                        }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#92400e' }}>
                                    Patient-Reported Allergies
                                </h3>
                            </div>
                            <div style={{ fontSize: '0.95rem', color: '#78350f', whiteSpace: 'pre-wrap' }}>
                                {manualAllergies}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ProfileSection({ patient }: { patient: PatientData }) {
    return (
        <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>
                Profile Information
            </h2>
            
            <div style={{ display: 'grid', gap: '2rem' }}>
                {/* Personal Information */}
                <InfoCard title="Personal Information">
                    <InfoRow label="Full Name" value={`${patient.first_name} ${patient.middle_name} ${patient.last_name}`} />
                    <InfoRow label="Date of Birth" value={patient.date_of_birth || 'Not provided'} />
                    <InfoRow label="Blood Type" value={patient.blood_type || 'Not provided'} />
                </InfoCard>

                {/* Contact Information */}
                <InfoCard title="Contact Information">
                    <InfoRow label="Email" value={patient.email || 'Not provided'} />
                    <InfoRow label="Phone" value={patient.phone || 'Not provided'} />
                    <InfoRow label="Address" value={patient.address_line1 ? `${patient.address_line1}, ${patient.city}, ${patient.state}` : 'Not provided'} />
                </InfoCard>

                {/* Healthcare Provider */}
                {patient.fhir_connected && (
                    <InfoCard title="Healthcare Provider">
                        <InfoRow label="Provider" value={patient.provider_name || 'Unknown'} />
                        <InfoRow label="Status" value="Connected" />
                    </InfoCard>
                )}
            </div>
        </div>
    );
}

function InfoCard({ title, children }: any) {
    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#374151' }}>
                {title}
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
