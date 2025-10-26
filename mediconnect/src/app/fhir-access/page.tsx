'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';

interface PatientData {
  patient_id: string;
  patient_name: string;
  demographics: any;
  conditions: any;
  allergies: {
    summary: string[];
    full_data: any;
  };
  medications: {
    summary: string[];
    full_data: any;
  };
  vital_signs: any;
  procedures: any;
  immunizations: any;
}

interface AuthStatus {
  authenticated: boolean;
  patient_id?: string;
  is_practitioner?: boolean;
  patient_context_available?: boolean;
  token_type?: string;
  scope?: string;
  fhir_user?: string;
  user_profile?: Record<string, any>;
  expires_in?: number;
  expires_at?: number;
}

interface ScopeDetail {
  label: string;
  values: string[];
  emptyNote?: string;
}

const toTitleCase = (value?: string): string => {
  if (!value) {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const formatAddress = (address: any): string | null => {
  if (!address) {
    return null;
  }

  const parts: string[] = [];
  if (Array.isArray(address.line) && address.line.length > 0) {
    parts.push(address.line.filter(Boolean).join(', '));
  } else if (address.line) {
    parts.push(address.line);
  }

  if (address.city) {
    parts.push(address.city);
  }
  if (address.state) {
    parts.push(address.state);
  }
  if (address.postalCode) {
    parts.push(address.postalCode);
  }

  return parts.length ? parts.join(', ') : null;
};

export default function FHIRAccessPage() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchPatientData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/patient-info`, {
        credentials: 'include' // Include session cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please login again.');
        }
        if (response.status === 403) {
          throw new Error(
            'FHIR server denied access (403). Confirm that the app’s Epic Client ID is registered and that the granted SMART scopes include patient-level read permissions.'
          );
        }
        const errorData = await response.json().catch(() => ({ detail: undefined }));
        throw new Error(errorData.detail || 'Failed to fetch patient data');
      }

      const data = await response.json();
      setPatientData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth-status`, {
        credentials: 'include' // Important: include session cookies
      });

      if (!response.ok) {
        throw new Error('Failed to check authentication status');
      }

      const status = await response.json();
      setAuthStatus(status);

      if (!status.authenticated) {
        setError('Not authenticated. Please login first.');
      } else {
        setError('');
        const hasPatientContext = Boolean(
          status.patient_context_available ??
          (status.patient_id && status.patient_id !== 'PRACTITIONER_LOGIN' && status.patient_id !== 'Unknown')
        );
        if (hasPatientContext) {
          await fetchPatientData();
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchPatientData]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const isPractitionerLogin = Boolean(
    authStatus?.is_practitioner || authStatus?.patient_id === 'PRACTITIONER_LOGIN'
  );
  const patientContextAvailable = Boolean(
    authStatus?.patient_context_available ??
      (authStatus?.patient_id && authStatus.patient_id !== 'Unknown' && authStatus.patient_id !== 'PRACTITIONER_LOGIN')
  );
  const missingPatientContext = authStatus?.authenticated && !isPractitionerLogin && !patientContextAvailable;

  const handleLogin = () => {
    // Redirect to the FastAPI patient login endpoint (patient portal)
    window.location.href = `${API_BASE}/patient-login`;
  };

  const handleProviderLogin = () => {
    // Redirect to the FastAPI provider login endpoint
    window.location.href = `${API_BASE}/login`;
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setAuthStatus(null);
      setPatientData(null);
      router.push('/');
    } catch (err: any) {
      setError('Failed to logout');
    }
  };

  const scopeList = authStatus?.scope?.split(/\s+/).filter(Boolean) ?? [];
  const patientFacingScopes = scopeList.filter(scope =>
    /(allergy|patient|condition|observation|careplan|medication)/i.test(scope)
  );

  const getScopeDetails = (scope: string): ScopeDetail => {
    const normalized = scope.toLowerCase();
    const noDataNote = patientData
      ? 'No patient data returned for this scope.'
      : 'Patient data not loaded yet.';

    const buildDetail = (label: string, values: string[]): ScopeDetail => ({
      label,
      values,
      emptyNote: values.length === 0 ? noDataNote : undefined,
    });

    if (normalized.includes('allergyintolerance')) {
      const summaries = patientData?.allergies?.summary ?? [];
      return buildDetail('AllergyIntolerance.Read (R4)', summaries);
    }

    if (
      normalized.includes('patient.read') ||
      normalized.includes('patient (demographics)') ||
      (normalized.includes('patient') && normalized.includes('demographics'))
    ) {
      const details: string[] = [];
      if (patientData) {
        if (patientData.patient_name) {
          details.push(`Name: ${patientData.patient_name}`);
        }
        const gender = patientData.demographics?.gender;
        if (gender) {
          details.push(`Gender: ${toTitleCase(gender)}`);
        }
        const birthDate = patientData.demographics?.birthDate;
        if (birthDate) {
          details.push(`DOB: ${birthDate}`);
        }
        const telecom = Array.isArray(patientData.demographics?.telecom)
          ? patientData.demographics?.telecom.find((item: any) => item?.value)
          : undefined;
        if (telecom?.value) {
          details.push(`Contact: ${telecom.value}`);
        }
        const address = Array.isArray(patientData.demographics?.address)
          ? patientData.demographics?.address[0]
          : undefined;
        const formattedAddress = formatAddress(address);
        if (formattedAddress) {
          details.push(`Address: ${formattedAddress}`);
        }
      }
      return buildDetail('Patient.Read (Demographics) (R4)', details);
    }

    if (normalized.includes('condition')) {
      const entries = patientData?.conditions?.entry ?? [];
      const conditionValues = entries
        .slice(0, 5)
        .map((entry: any) => {
          const resource = entry?.resource ?? {};
          return (
            resource.code?.coding?.[0]?.display ??
            resource.code?.text ??
            resource.code?.coding?.[0]?.code ??
            ''
          );
        })
        .filter(Boolean);
      const label = normalized.includes('medical history')
        ? 'Condition.Read (Medical History) (R4)'
        : normalized.includes('problems')
        ? 'Condition.Read (Problems) (R4)'
        : 'Condition.Read (R4)';
      return buildDetail(label, conditionValues);
    }

    if (normalized.includes('observation')) {
      const entries = patientData?.vital_signs?.entry ?? [];
      const vitals = entries
        .slice(0, 5)
        .map((entry: any) => {
          const resource = entry?.resource ?? {};
          const display =
            resource.code?.coding?.[0]?.display ||
            resource.code?.text ||
            'Observation';
          const quantity = resource.valueQuantity;
          const measurement = quantity
            ? `${quantity.value ?? 'N/A'} ${quantity.unit ?? ''}`.trim()
            : resource.valueString ?? '';
          const date = resource.effectiveDateTime
            ? new Date(resource.effectiveDateTime).toLocaleDateString()
            : '';
          return [display, measurement, date].filter(Boolean).join(' • ');
        })
        .filter(Boolean);
      return buildDetail('Observation.Read (Vital Signs) (R4)', vitals);
    }

    if (normalized.includes('careplan')) {
      return {
        label: 'CarePlan.Read (Care Path) (R4)',
        values: [],
        emptyNote: noDataNote,
      };
    }

    if (normalized.includes('medication')) {
      const summaries = patientData?.medications?.summary ?? [];
  return buildDetail('MedicationRequest.Read (R4)', summaries);
    }

    return {
      label: scope,
      values: [],
      emptyNote: noDataNote,
    };
  };

  const formatTokenExpiry = () => {
    if (authStatus?.expires_at) {
      const expiryMs = authStatus.expires_at * 1000;
      const now = Date.now();
      const minutesLeft = Math.max(Math.floor((expiryMs - now) / 60000), 0);
      const formattedDate = new Date(expiryMs).toLocaleString();
      return minutesLeft > 0
        ? `${formattedDate} (${minutesLeft} min left)`
        : `${formattedDate} (expired)`;
    }
    if (typeof authStatus?.expires_in === 'number') {
      const minutes = Math.max(Math.floor(authStatus.expires_in / 60), 0);
      return minutes > 0 ? `${minutes} min remaining` : 'Less than a minute';
    }
    return 'Not provided';
  };

  if (loading && !patientData) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <LoadingSpinner size={48} color="#3b82f6" />
          <h2 style={{ marginTop: '1rem', color: '#4b5563' }}>Loading Patient Data...</h2>
        </div>
      </div>
    );
  }

  if (!authStatus?.authenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>MediConnect FHIR Access</h1>
          <p style={styles.subtitle}>Access patient medical records securely via FHIR</p>
          
          {error && (
            <div style={styles.errorBox}>
              <strong>Error: {error}</strong>
            </div>
          )}

          <div style={styles.infoBox}>
            <h3>Secure Authentication Required</h3>
            <p>
              You need to authenticate with the EHR system to access patient data.
              This uses SMART on FHIR OAuth2 protocol.
            </p>
            <ul style={styles.featureList}>
              <li>Secure OAuth2 authentication</li>
              <li>HIPAA-compliant data access</li>
              <li>Real-time patient information</li>
              <li>Comprehensive medical history</li>
            </ul>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={handleLogin} style={styles.primaryButton}>
              Patient Portal Login
            </button>
            <button onClick={handleProviderLogin} style={styles.secondaryButton}>
              Provider/Practitioner Login
            </button>
          </div>

          <div style={styles.helpText}>
            <p><strong>For Patients:</strong> Click "Patient Portal Login" and use patient test credentials (e.g., fhircamila, fhirjason)</p>
            <p><strong>For Providers:</strong> Click "Provider/Practitioner Login" and use EMT/provider credentials</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>MediConnect - Patient Record</h1>
          {authStatus && (
            <p style={styles.headerSubtitle}>
              Authenticated | Patient ID: {authStatus.patient_id}
            </p>
          )}
        </div>
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </div>

        {isPractitionerLogin && (
          <div style={styles.warningBox}>
            <strong>Practitioner login detected.</strong>
            <p>
              You authenticated with a practitioner account, which does not include a patient launch context. Log out and
              sign in using a SMART-on-FHIR patient test account (for example <code>fhircamila</code> or
              <code>fhirjason</code>) to view patient data.
            </p>
          </div>
        )}

        {!isPractitionerLogin && missingPatientContext && (
          <div style={styles.warningBox}>
            <strong>No patient context returned.</strong>
            <p>
              The EHR did not supply a patient identifier for this session. Re-launch the SMART flow and ensure the account
              you use is provisioned for patient portal access.
            </p>
          </div>
        )}

      <div style={styles.credentialsCard}>
        <h2 style={styles.sectionTitle}>Authentication Details</h2>
        <div style={styles.credentialsGrid}>
          <div style={styles.credentialItem}>
            <span style={styles.credentialLabel}>FHIR User</span>
            <span style={styles.credentialValue}>{authStatus?.fhir_user ?? 'Unavailable'}</span>
          </div>
          <div style={styles.credentialItem}>
            <span style={styles.credentialLabel}>Patient Context</span>
            <span style={styles.credentialValue}>{authStatus?.patient_id ?? 'Unknown'}</span>
          </div>
          <div style={styles.credentialItem}>
            <span style={styles.credentialLabel}>Token Type</span>
            <span style={styles.credentialValue}>{authStatus?.token_type ?? 'Bearer'}</span>
          </div>
          <div style={styles.credentialItem}>
            <span style={styles.credentialLabel}>Token Expires</span>
            <span style={styles.credentialValue}>{formatTokenExpiry()}</span>
          </div>
        </div>

        {patientFacingScopes.length > 0 && (
          <div style={styles.scopeDetailsContainer}>
            <h3 style={styles.scopeDetailsTitle}>FHIR Data by Scope</h3>
            <div style={styles.scopeDetailsGrid}>
              {patientFacingScopes.map((scope, idx) => {
                const { label, values, emptyNote } = getScopeDetails(scope);
                return (
                  <div key={`${scope}-${idx}`} style={styles.scopeDetailCard}>
                    <span style={styles.scopeDetailScope}>{label}</span>
                    {values.length > 0 ? (
                      <ul style={styles.scopeDetailList}>
                        {values.map((value, valueIdx) => (
                          <li key={`${scope}-${idx}-${valueIdx}`}>{value}</li>
                        ))}
                      </ul>
                    ) : (
                      <div style={styles.scopeDetailNone}>
                        None
                        {emptyNote && (
                          <span style={styles.scopeDetailNote}>{emptyNote}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={styles.errorBox}>
          <strong>Error: {error}</strong>
        </div>
      )}

      {!patientData ? (
        <div style={styles.card}>
          <h2>Ready to Load Patient Data</h2>
          <p>Click the button below to fetch comprehensive patient information from the FHIR server.</p>
          <button
            onClick={fetchPatientData}
            style={styles.primaryButton}
            disabled={loading || isPractitionerLogin || missingPatientContext}
          >
            {loading ? <LoadingSpinner size={20} color="#ffffff" /> : 'Load Patient Data'}
          </button>
          {(isPractitionerLogin || missingPatientContext) && (
            <p style={styles.helpText}>
              Unable to load data because the session lacks a patient launch context. Log out and sign in with a patient
              portal account provided by Epic’s sandbox to continue.
            </p>
          )}
        </div>
      ) : (
        <div style={styles.dataContainer}>
          {/* Patient Header */}
          <div style={styles.patientHeader}>
            <div style={styles.patientAvatar}>
              {patientData.patient_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={styles.patientName}>{patientData.patient_name}</h2>
              <p style={styles.patientId}>Patient ID: {patientData.patient_id}</p>
            </div>
            <button 
              onClick={fetchPatientData} 
              style={styles.refreshButton}
              disabled={loading}
            >
              {loading ? <LoadingSpinner size={20} color="#ffffff" /> : 'Refresh'}
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={styles.tabs}>
            {['overview', 'allergies', 'medications', 'conditions', 'vitals'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab ? styles.activeTab : {})
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={styles.tabContent}>
            {activeTab === 'overview' && (
              <div>
                <h3 style={styles.sectionTitle}>Patient Overview</h3>
                
                <div style={styles.quickInfo}>
                  <div style={styles.infoCard}>
                    <div style={styles.infoIcon}>Allergies</div>
                    <div>
                      <div style={styles.infoLabel}>Allergies</div>
                      <div style={styles.infoValue}>
                        {patientData.allergies.summary.length}
                      </div>
                    </div>
                  </div>
                  
                  <div style={styles.infoCard}>
                    <div style={styles.infoIcon}>Medications</div>
                    <div>
                      <div style={styles.infoLabel}>Medications</div>
                      <div style={styles.infoValue}>
                        {patientData.medications.summary.length}
                      </div>
                    </div>
                  </div>
                  
                  <div style={styles.infoCard}>
                    <div style={styles.infoIcon}>Conditions</div>
                    <div>
                      <div style={styles.infoLabel}>Conditions</div>
                      <div style={styles.infoValue}>
                        {patientData.conditions?.entry?.length || 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.criticalSection}>
                  <h4 style={styles.criticalTitle}>Critical Information</h4>
                  
                  {patientData.allergies.summary.length > 0 ? (
                    <div style={styles.allergyAlert}>
                      <strong>ALLERGIES:</strong>
                      <ul style={styles.list}>
                        {patientData.allergies.summary.map((allergy, idx) => (
                          <li key={idx}>{allergy}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p style={styles.noData}>No known allergies</p>
                  )}

                  {patientData.medications.summary.length > 0 && (
                    <div style={styles.medicationInfo}>
                      <strong>CURRENT MEDICATIONS:</strong>
                      <ul style={styles.list}>
                        {patientData.medications.summary.slice(0, 5).map((med, idx) => (
                          <li key={idx}>{med}</li>
                        ))}
                      </ul>
                      {patientData.medications.summary.length > 5 && (
                        <p style={styles.moreInfo}>
                          + {patientData.medications.summary.length - 5} more medications
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'allergies' && (
              <div>
                <h3 style={styles.sectionTitle}>Allergies & Intolerances</h3>
                {patientData.allergies.summary.length > 0 ? (
                  <div style={styles.listContainer}>
                    {patientData.allergies.summary.map((allergy, idx) => (
                      <div key={idx} style={styles.listItem}>
                        <div style={styles.listItemIcon}>-</div>
                        <div style={styles.listItemText}>{allergy}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.noData}>No known allergies recorded</p>
                )}
                
                <details style={styles.details}>
                  <summary style={styles.summary}>View Raw FHIR Data</summary>
                  <pre style={styles.pre}>
                    {JSON.stringify(patientData.allergies.full_data, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {activeTab === 'medications' && (
              <div>
                <h3 style={styles.sectionTitle}>Current Medications</h3>
                {patientData.medications.summary.length > 0 ? (
                  <div style={styles.listContainer}>
                    {patientData.medications.summary.map((med, idx) => (
                      <div key={idx} style={styles.listItem}>
                        <div style={styles.listItemIcon}>-</div>
                        <div style={styles.listItemText}>{med}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={styles.noData}>No active medications recorded</p>
                )}
                
                <details style={styles.details}>
                  <summary style={styles.summary}>View Raw FHIR Data</summary>
                  <pre style={styles.pre}>
                    {JSON.stringify(patientData.medications.full_data, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {activeTab === 'conditions' && (
              <div>
                <h3 style={styles.sectionTitle}>Medical Conditions</h3>
                {patientData.conditions?.entry?.length > 0 ? (
                  <div style={styles.listContainer}>
                    {patientData.conditions.entry.map((entry: any, idx: number) => {
                      const condition = entry.resource;
                      const display = condition.code?.coding?.[0]?.display || 
                                    condition.code?.text || 
                                    'Unknown Condition';
                      return (
                        <div key={idx} style={styles.listItem}>
                          <div style={styles.listItemIcon}>-</div>
                          <div>
                            <div style={styles.listItemText}>{display}</div>
                            {condition.clinicalStatus && (
                              <div style={styles.listItemMeta}>
                                Status: {condition.clinicalStatus.coding?.[0]?.code}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={styles.noData}>No conditions recorded</p>
                )}
                
                <details style={styles.details}>
                  <summary style={styles.summary}>View Raw FHIR Data</summary>
                  <pre style={styles.pre}>
                    {JSON.stringify(patientData.conditions, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {activeTab === 'vitals' && (
              <div>
                <h3 style={styles.sectionTitle}>Vital Signs</h3>
                {patientData.vital_signs?.entry?.length > 0 ? (
                  <div style={styles.listContainer}>
                    {patientData.vital_signs.entry.slice(0, 10).map((entry: any, idx: number) => {
                      const obs = entry.resource;
                      const display = obs.code?.coding?.[0]?.display || 
                                    obs.code?.text || 
                                    'Observation';
                      const value = obs.valueQuantity?.value || obs.valueString || 'N/A';
                      const unit = obs.valueQuantity?.unit || '';
                      
                      return (
                        <div key={idx} style={styles.listItem}>
                          <div style={styles.listItemIcon}>-</div>
                          <div style={{flex: 1}}>
                            <div style={styles.listItemText}>{display}</div>
                            <div style={styles.vitalValue}>
                              {value} {unit}
                            </div>
                            {obs.effectiveDateTime && (
                              <div style={styles.listItemMeta}>
                                {new Date(obs.effectiveDateTime).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={styles.noData}>No vital signs recorded</p>
                )}
                
                <details style={styles.details}>
                  <summary style={styles.summary}>View Raw FHIR Data</summary>
                  <pre style={styles.pre}>
                    {JSON.stringify(patientData.vital_signs, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const TEXT_COLOR = '#000000';

const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '2rem',
    color: TEXT_COLOR,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  warningBox: {
    backgroundColor: 'rgba(255, 243, 205, 0.95)',
    border: '1px solid #f0ad4e',
    color: '#8a6d3b',
    padding: '1rem 1.5rem',
    borderRadius: '12px',
    marginBottom: '1.5rem',
    lineHeight: 1.5,
  },
  headerTitle: {
    color: TEXT_COLOR,
    margin: 0,
    fontSize: '1.8rem',
  },
  headerSubtitle: {
    color: TEXT_COLOR,
    margin: '0.5rem 0 0 0',
  },
  credentialsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '1.8rem',
    borderRadius: '16px',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.08)',
    marginBottom: '1.5rem',
    border: '1px solid rgba(226, 232, 240, 0.7)',
  },
  credentialsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  credentialItem: {
    backgroundColor: '#f7fafc',
    borderRadius: '12px',
    padding: '1rem',
    border: '1px solid #e2e8f0',
    minHeight: '100px',
  },
  credentialLabel: {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: TEXT_COLOR,
    fontWeight: 600,
  },
  credentialValue: {
    display: 'block',
    marginTop: '0.5rem',
    color: TEXT_COLOR,
    fontSize: '1rem',
    fontWeight: 600,
    wordBreak: 'break-word',
  },
  scopeDetailsContainer: {
    marginTop: '1.5rem',
    backgroundColor: '#f7fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '1.25rem',
  },
  scopeDetailsTitle: {
    margin: 0,
    fontSize: '1.1rem',
    color: TEXT_COLOR,
  },
  scopeDetailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  scopeDetailCard: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '1rem',
    minHeight: '120px',
  },
  scopeDetailScope: {
    display: 'block',
    fontWeight: 700,
    marginBottom: '0.5rem',
    color: TEXT_COLOR,
  },
  scopeDetailList: {
    margin: 0,
    paddingLeft: '1.25rem',
    color: TEXT_COLOR,
    fontSize: '0.9rem',
  },
  scopeDetailNone: {
    color: TEXT_COLOR,
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  scopeDetailNote: {
    display: 'block',
    color: '#4a5568',
    fontSize: '0.8rem',
    marginTop: '0.35rem',
  },
  logoutButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#e53e3e',
    color: TEXT_COLOR,
    border: '1px solid #c53030',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '2.5rem',
    borderRadius: '16px',
    maxWidth: '600px',
    margin: '0 auto',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
  },
  loadingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '3rem',
    borderRadius: '16px',
    maxWidth: '400px',
    margin: '0 auto',
    textAlign: 'center',
  },
  title: {
    color: TEXT_COLOR,
    fontSize: '2rem',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  subtitle: {
    color: TEXT_COLOR,
    textAlign: 'center',
    marginBottom: '2rem',
  },
  infoBox: {
    backgroundColor: '#ebf8ff',
    padding: '1.5rem',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    border: '1px solid #90cdf4',
  },
  featureList: {
    marginTop: '1rem',
    paddingLeft: '1.5rem',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  primaryButton: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#4299e1',
    color: '#ffffff',
    border: '1px solid #2b6cb0',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#ffffff',
    color: '#4299e1',
    border: '2px solid #4299e1',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  helpText: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f7fafc',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: TEXT_COLOR,
  },
  errorBox: {
    backgroundColor: '#fff5f5',
    color: TEXT_COLOR,
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    border: '1px solid #feb2b2',
  },
  dataContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '16px',
    padding: '2rem',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
  },
  patientHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '2px solid #e2e8f0',
  },
  patientAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#4299e1',
    color: TEXT_COLOR,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.5rem',
    fontWeight: 'bold',
  },
  patientName: {
    margin: 0,
    color: TEXT_COLOR,
    fontSize: '1.8rem',
  },
  patientId: {
    margin: '0.25rem 0 0 0',
    color: TEXT_COLOR,
  },
  refreshButton: {
    marginLeft: 'auto',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#48bb78',
    color: TEXT_COLOR,
    border: '1px solid #2f855a',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '2rem',
    borderBottom: '2px solid #e2e8f0',
  },
  tab: {
    padding: '1rem 1.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottomWidth: '3px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'transparent',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    color: TEXT_COLOR,
    transition: 'all 0.2s',
  },
  activeTab: {
    color: TEXT_COLOR,
    borderBottomColor: '#000000',
  },
  tabContent: {
    minHeight: '400px',
  },
  sectionTitle: {
    color: TEXT_COLOR,
    fontSize: '1.5rem',
    marginBottom: '1.5rem',
  },
  quickInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  infoCard: {
    backgroundColor: '#f7fafc',
    padding: '1.5rem',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    border: '2px solid #e2e8f0',
  },
  infoIcon: {
    fontSize: '2.5rem',
  },
  infoLabel: {
    color: TEXT_COLOR,
    fontSize: '0.9rem',
    marginBottom: '0.25rem',
  },
  infoValue: {
    color: TEXT_COLOR,
    fontSize: '1.8rem',
    fontWeight: 'bold',
  },
  criticalSection: {
    backgroundColor: '#fffaf0',
    padding: '1.5rem',
    borderRadius: '12px',
    border: '2px solid #fbd38d',
  },
  criticalTitle: {
    color: TEXT_COLOR,
    marginTop: 0,
  },
  allergyAlert: {
    backgroundColor: '#fff5f5',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    border: '2px solid #fc8181',
  },
  medicationInfo: {
    backgroundColor: '#f0fff4',
    padding: '1rem',
    borderRadius: '8px',
    border: '2px solid #9ae6b4',
  },
  list: {
    marginTop: '0.5rem',
    paddingLeft: '1.5rem',
  },
  moreInfo: {
    color: TEXT_COLOR,
    fontStyle: 'italic',
    marginTop: '0.5rem',
  },
  noData: {
    color: TEXT_COLOR,
    fontStyle: 'italic',
    padding: '2rem',
    textAlign: 'center',
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  listItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#f7fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  listItemIcon: {
    fontSize: '1.5rem',
  },
  listItemText: {
    flex: 1,
    color: TEXT_COLOR,
    fontWeight: '500',
  },
  listItemMeta: {
    color: TEXT_COLOR,
    fontSize: '0.875rem',
    marginTop: '0.25rem',
  },
  vitalValue: {
    color: TEXT_COLOR,
    fontSize: '1.2rem',
    fontWeight: 'bold',
    marginTop: '0.25rem',
  },
  details: {
    marginTop: '2rem',
    backgroundColor: '#f7fafc',
    padding: '1rem',
    borderRadius: '8px',
  },
  summary: {
    cursor: 'pointer',
    fontWeight: '600',
    color: TEXT_COLOR,
    padding: '0.5rem',
  },
  pre: {
    backgroundColor: '#f7fafc',
    color: TEXT_COLOR,
    padding: '1rem',
    borderRadius: '8px',
    overflow: 'auto',
    fontSize: '0.875rem',
    marginTop: '1rem',
  },
};
