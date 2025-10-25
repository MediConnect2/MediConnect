'use client'

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';

interface MissingData {
    allergies: boolean;
    conditions: boolean;
    medications: boolean;
    procedures: boolean;
    immunizations: boolean;
    emergency_contact: boolean;
    phone: boolean;
    email: boolean;
    blood_type: boolean;
    date_of_birth: boolean;
}

export default function CompleteProfilePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [checkingData, setCheckingData] = useState(true);
    const [error, setError] = useState('');
    const [patientData, setPatientData] = useState<any>(null);
    const [missingData, setMissingData] = useState<MissingData>({
        allergies: false,
        conditions: false,
        medications: false,
        procedures: false,
        immunizations: false,
        emergency_contact: false,
        phone: false,
        email: false,
        blood_type: false,
        date_of_birth: false
    });
    
    const [form, setForm] = useState({
        email: '',
        phone: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        date_of_birth: '',
        blood_type: '',
        allergies: '',
        conditions: '',
        medications: '',
        procedures: '',
        immunizations: ''
    });

    useEffect(() => {
        const username = localStorage.getItem('mediconnect_username') || searchParams.get('username');
        
        if (!username) {
            router.push('/patient-register');
            return;
        }

        fetchAndAnalyzePatientData(username);
    }, []);

    const fetchAndAnalyzePatientData = async (username: string) => {
        try {
            const response = await fetch(`${API_BASE}/patient/profile/${username}`);

            if (response.ok) {
                const data = await response.json();
                setPatientData(data);
                
                // Analyze what data is missing
                const missing: MissingData = {
                    allergies: !hasValidFHIRData(data.fhir_data?.allergies),
                    conditions: !hasValidFHIRData(data.fhir_data?.conditions),
                    medications: !hasValidFHIRData(data.fhir_data?.medications),
                    procedures: !hasValidFHIRData(data.fhir_data?.procedures),
                    immunizations: !hasValidFHIRData(data.fhir_data?.immunizations),
                    emergency_contact: !data.emergency_contact_name || !data.emergency_contact_phone,
                    phone: !hasValidContactInfo(data.fhir_data?.patient, 'phone') && !data.phone,
                    email: !hasValidContactInfo(data.fhir_data?.patient, 'email') && !data.email,
                    blood_type: !data.blood_type,
                    date_of_birth: !hasValidBirthDate(data.fhir_data?.patient) && !data.date_of_birth
                };

                setMissingData(missing);

                // Pre-fill form with FHIR data if available
                const prefillData: any = {
                    email: data.email || extractEmail(data.fhir_data?.patient) || '',
                    phone: data.phone || extractPhone(data.fhir_data?.patient) || '',
                    emergency_contact_name: data.emergency_contact_name || '',
                    emergency_contact_phone: data.emergency_contact_phone || '',
                    date_of_birth: data.date_of_birth || data.fhir_data?.patient?.birthDate || '',
                    blood_type: data.blood_type || '',
                    allergies: data.allergies || '',
                    conditions: data.conditions || '',
                    medications: data.medications || '',
                    procedures: data.procedures || '',
                    immunizations: data.immunizations || ''
                };

                setForm(prefillData);
            }
        } catch (err) {
            console.error('Failed to fetch patient data:', err);
        } finally {
            setCheckingData(false);
        }
    };

    const hasValidFHIRData = (bundle: any): boolean => {
        if (!bundle || !bundle.entry) return false;
        // Check if there are actual resource entries (not just OperationOutcome)
        const resources = bundle.entry.filter((e: any) => 
            e.resource?.resourceType !== 'OperationOutcome'
        );
        return resources.length > 0;
    };

    const hasValidContactInfo = (patient: any, type: 'phone' | 'email'): boolean => {
        if (!patient?.telecom) return false;
        return patient.telecom.some((t: any) => t.system === type && t.value);
    };

    const hasValidBirthDate = (patient: any): boolean => {
        return !!patient?.birthDate;
    };

    const extractEmail = (patient: any): string => {
        const emailTelecom = patient?.telecom?.find((t: any) => t.system === 'email');
        return emailTelecom?.value || '';
    };

    const extractPhone = (patient: any): string => {
        const phoneTelecom = patient?.telecom?.find((t: any) => t.system === 'phone');
        return phoneTelecom?.value || '';
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const username = localStorage.getItem('mediconnect_username');

            const response = await fetch(`${API_BASE}/patient/update-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mediconnect_username: username,
                    ...form
                })
            });

            if (response.ok) {
                localStorage.removeItem('fhir_session_id');
                router.push(`/patient-dashboard?username=${username}`);
            } else {
                const errorData = await response.json();
                setError(errorData.detail || 'Failed to update profile');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => {
        const username = localStorage.getItem('mediconnect_username');
        localStorage.removeItem('fhir_session_id');
        router.push(`/patient-dashboard?username=${username}`);
    };

    const hasAnyMissingData = Object.values(missingData).some(v => v);

    if (checkingData) {
        return (
            <div style={{ 
                minHeight: '100vh', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
                <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: '600' }}>
                    Analyzing your medical records...
                </div>
            </div>
        );
    }

    // If no data is missing, skip to dashboard
    if (!hasAnyMissingData) {
        router.push(`/patient-dashboard?username=${localStorage.getItem('mediconnect_username')}`);
        return null;
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '2rem',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
            <div style={{ 
                maxWidth: '900px', 
                margin: '0 auto',
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '3rem',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
            }}>
                <h1 style={{ 
                    color: '#1a365d',
                    fontSize: '2rem',
                    fontWeight: '700',
                    marginBottom: '0.5rem'
                }}>
                    Complete Your Medical Profile
                </h1>
                
                <p style={{ 
                    color: '#6b7280',
                    fontSize: '1rem',
                    marginBottom: '2rem'
                }}>
                    We've imported your medical records from {patientData?.provider_name || 'your healthcare provider'}. 
                    Please provide the following missing information to complete your profile.
                </p>

                {error && (
                    <div style={{
                        backgroundColor: '#fef2f2',
                        border: '2px solid #fecaca',
                        borderRadius: '12px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        color: '#991b1b'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Contact Information - Only if missing */}
                    {(missingData.email || missingData.phone) && (
                        <Section title="Contact Information">
                            <div style={{ display: 'grid', gridTemplateColumns: missingData.email && missingData.phone ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                                {missingData.email && (
                                    <FormField
                                        label="Email Address"
                                        type="email"
                                        name="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        placeholder="your.email@example.com"
                                        required
                                    />
                                )}

                                {missingData.phone && (
                                    <FormField
                                        label="Phone Number"
                                        type="tel"
                                        name="phone"
                                        value={form.phone}
                                        onChange={handleChange}
                                        placeholder="(555) 123-4567"
                                        required
                                    />
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Emergency Contact - Always show if missing */}
                    {missingData.emergency_contact && (
                        <Section title="Emergency Contact">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <FormField
                                    label="Contact Name"
                                    type="text"
                                    name="emergency_contact_name"
                                    value={form.emergency_contact_name}
                                    onChange={handleChange}
                                    placeholder="John Doe"
                                    required
                                />

                                <FormField
                                    label="Contact Phone"
                                    type="tel"
                                    name="emergency_contact_phone"
                                    value={form.emergency_contact_phone}
                                    onChange={handleChange}
                                    placeholder="(555) 123-4567"
                                    required
                                />
                            </div>
                        </Section>
                    )}

                    {/* Medical Information - Only if missing */}
                    {(missingData.date_of_birth || missingData.blood_type) && (
                        <Section title="Medical Information">
                            <div style={{ display: 'grid', gridTemplateColumns: missingData.date_of_birth && missingData.blood_type ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                                {missingData.date_of_birth && (
                                    <FormField
                                        label="Date of Birth"
                                        type="date"
                                        name="date_of_birth"
                                        value={form.date_of_birth}
                                        onChange={handleChange}
                                    />
                                )}

                                {missingData.blood_type && (
                                    <div>
                                        <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                            Blood Type (Optional)
                                        </label>
                                        <select
                                            name="blood_type"
                                            value={form.blood_type}
                                            onChange={handleChange}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                border: '2px solid #e5e7eb',
                                                borderRadius: '8px',
                                                fontSize: '1rem',
                                                backgroundColor: 'white'
                                            }}
                                        >
                                            <option value="">Select blood type</option>
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Health Information - Only show sections that are missing */}
                    {(missingData.allergies || missingData.conditions || missingData.medications || 
                      missingData.procedures || missingData.immunizations) && (
                        <Section title="Health Information">
                            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                The following medical information was not found in your provider's records. 
                                Please provide any relevant information:
                            </p>

                            {missingData.allergies && (
                                <FormFieldTextarea
                                    label="Allergies"
                                    name="allergies"
                                    value={form.allergies}
                                    onChange={handleChange}
                                    placeholder="List any known allergies (medications, foods, environmental, etc.)"
                                    rows={2}
                                />
                            )}

                            {missingData.conditions && (
                                <FormFieldTextarea
                                    label="Medical Conditions"
                                    name="conditions"
                                    value={form.conditions}
                                    onChange={handleChange}
                                    placeholder="List any chronic conditions, diagnoses, or ongoing health issues"
                                    rows={2}
                                />
                            )}

                            {missingData.medications && (
                                <FormFieldTextarea
                                    label="Current Medications"
                                    name="medications"
                                    value={form.medications}
                                    onChange={handleChange}
                                    placeholder="List current medications with dosages (e.g., Lisinopril 10mg daily)"
                                    rows={2}
                                />
                            )}

                            {missingData.procedures && (
                                <FormFieldTextarea
                                    label="Past Procedures"
                                    name="procedures"
                                    value={form.procedures}
                                    onChange={handleChange}
                                    placeholder="List any surgeries or significant medical procedures"
                                    rows={2}
                                />
                            )}

                            {missingData.immunizations && (
                                <FormFieldTextarea
                                    label="Immunizations"
                                    name="immunizations"
                                    value={form.immunizations}
                                    onChange={handleChange}
                                    placeholder="List recent vaccinations (e.g., COVID-19, Flu, Tdap)"
                                    rows={2}
                                />
                            )}
                        </Section>
                    )}

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: '1rem 2rem',
                                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {loading ? 'Saving...' : 'Save & Continue'}
                        </button>

                        <button
                            type="button"
                            onClick={handleSkip}
                            style={{
                                padding: '1rem 2rem',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                border: '2px solid #e5e7eb',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            Skip for Now
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: '#374151', fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                {title}
            </h2>
            {children}
        </div>
    );
}

function FormField({ label, type, name, value, onChange, placeholder, required }: any) {
    return (
        <div>
            <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem'
                }}
            />
        </div>
    );
}

function FormFieldTextarea({ label, name, value, onChange, placeholder, rows }: any) {
    return (
        <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                {label} (Optional)
            </label>
            <textarea
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                }}
            />
        </div>
    );
}


    useEffect(() => {
        // Get username from localStorage or URL
        const username = localStorage.getItem('mediconnect_username') || searchParams.get('username');
        
        if (!username) {
            router.push('/patient-register');
            return;
        }

        // Fetch existing patient data to pre-fill form
        fetchPatientData(username);
    }, []);

    const fetchPatientData = async (username: string) => {
        try {
            const token = localStorage.getItem('patient_token');
            const response = await fetch(`${API_BASE}/patient/profile/${username}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (response.ok) {
                const data = await response.json();
                setPatientData(data);
                
                // Pre-fill form with existing data
                setForm({
                    email: data.email || '',
                    phone: data.phone || '',
                    emergency_contact_name: data.emergency_contact_name || '',
                    emergency_contact_phone: data.emergency_contact_phone || '',
                    address_line1: data.address_line1 || '',
                    address_line2: data.address_line2 || '',
                    city: data.city || '',
                    state: data.state || '',
                    zip_code: data.zip_code || '',
                    date_of_birth: data.date_of_birth || '',
                    blood_type: data.blood_type || '',
                    insurance_provider: data.insurance_provider || '',
                    insurance_policy_number: data.insurance_policy_number || ''
                });
            }
        } catch (err) {
            console.error('Failed to fetch patient data:', err);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const username = localStorage.getItem('mediconnect_username');
            const token = localStorage.getItem('patient_token');

            const response = await fetch(`${API_BASE}/patient/update-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    mediconnect_username: username,
                    ...form
                })
            });

            if (response.ok) {
                // Clear localStorage items used for registration
                localStorage.removeItem('fhir_session_id');
                
                // Redirect to patient dashboard
                router.push(`/patient-dashboard?username=${username}`);
            } else {
                const errorData = await response.json();
                setError(errorData.detail || 'Failed to update profile');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => {
        const username = localStorage.getItem('mediconnect_username');
        localStorage.removeItem('fhir_session_id');
        router.push(`/patient-dashboard?username=${username}`);
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '2rem',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
            <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto',
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '3rem',
                boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
            }}>
                <h1 style={{ 
                    color: '#1a365d',
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    marginBottom: '0.5rem',
                    textAlign: 'center'
                }}>
                    Complete Your Profile
                </h1>
                
                <p style={{ 
                    color: '#6b7280',
                    fontSize: '1.1rem',
                    textAlign: 'center',
                    marginBottom: '2rem'
                }}>
                    We've imported your medical records! Please provide any additional information to complete your profile.
                </p>

                {error && (
                    <div style={{
                        backgroundColor: '#fef2f2',
                        border: '2px solid #fecaca',
                        borderRadius: '12px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        color: '#991b1b'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Contact Information */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ color: '#374151', fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                            📞 Contact Information
                        </h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="your.email@example.com"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={form.phone}
                                    onChange={handleChange}
                                    placeholder="(555) 123-4567"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Emergency Contact */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ color: '#374151', fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                            🚨 Emergency Contact
                        </h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Contact Name
                                </label>
                                <input
                                    type="text"
                                    name="emergency_contact_name"
                                    value={form.emergency_contact_name}
                                    onChange={handleChange}
                                    placeholder="John Doe"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Contact Phone
                                </label>
                                <input
                                    type="tel"
                                    name="emergency_contact_phone"
                                    value={form.emergency_contact_phone}
                                    onChange={handleChange}
                                    placeholder="(555) 123-4567"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ color: '#374151', fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                            🏠 Address
                        </h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="text"
                                name="address_line1"
                                value={form.address_line1}
                                onChange={handleChange}
                                placeholder="Street Address"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '8px',
                                    fontSize: '1rem'
                                }}
                            />

                            <input
                                type="text"
                                name="address_line2"
                                value={form.address_line2}
                                onChange={handleChange}
                                placeholder="Apt, Suite, Unit (optional)"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '2px solid #e5e7eb',
                                    borderRadius: '8px',
                                    fontSize: '1rem'
                                }}
                            />

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                                <input
                                    type="text"
                                    name="city"
                                    value={form.city}
                                    onChange={handleChange}
                                    placeholder="City"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />

                                <input
                                    type="text"
                                    name="state"
                                    value={form.state}
                                    onChange={handleChange}
                                    placeholder="State"
                                    maxLength={2}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />

                                <input
                                    type="text"
                                    name="zip_code"
                                    value={form.zip_code}
                                    onChange={handleChange}
                                    placeholder="ZIP"
                                    maxLength={5}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Medical Information */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ color: '#374151', fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                            💉 Medical Information
                        </h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Date of Birth
                                </label>
                                <input
                                    type="date"
                                    name="date_of_birth"
                                    value={form.date_of_birth}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Blood Type
                                </label>
                                <select
                                    name="blood_type"
                                    value={form.blood_type}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="">Select blood type</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Insurance Information */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ color: '#374151', fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                            🏥 Insurance Information (Optional)
                        </h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Insurance Provider
                                </label>
                                <input
                                    type="text"
                                    name="insurance_provider"
                                    value={form.insurance_provider}
                                    onChange={handleChange}
                                    placeholder="Blue Cross, Aetna, etc."
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#374151', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Policy Number
                                </label>
                                <input
                                    type="text"
                                    name="insurance_policy_number"
                                    value={form.insurance_policy_number}
                                    onChange={handleChange}
                                    placeholder="Policy number"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '8px',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                flex: 1,
                                padding: '1rem 2rem',
                                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {loading ? 'Saving...' : 'Save & Continue'}
                        </button>

                        <button
                            type="button"
                            onClick={handleSkip}
                            style={{
                                padding: '1rem 2rem',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                border: '2px solid #e5e7eb',
                                borderRadius: '12px',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            Skip for Now
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
