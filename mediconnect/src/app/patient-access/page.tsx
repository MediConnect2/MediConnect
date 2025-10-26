'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';

interface PatientInfo {
  API: string;
  portal_name: string;
  auth_username: string;
  auth_password: string;
  first_name: string;
  middle_name: string;
  last_name: string;
}

interface AuthForm {
  mediconnect_username: string;
  password: string;
  driver_license_id: string;
}

export default function PatientAccessPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [authForm, setAuthForm] = useState<AuthForm>({
    mediconnect_username: '',
    password: '',
    driver_license_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    mediconnect_username: '',
    mediconnect_password: '',
    driver_license_id: '',
    delete_prompt: ''
  });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAuthForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First, verify credentials with /check-patient-access
      const authResponse = await fetch(`${API_BASE}/check-patient-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authForm)
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(errorData.detail || 'Authentication failed');
      }

      const authResult = await authResponse.json();
      
      if (authResult.status === 'success') {
        // Now login to get patient info and token
        const loginResponse = await fetch(`${API_BASE}/patient/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mediconnect_username: authForm.mediconnect_username,
            password: authForm.password
          })
        });

        if (!loginResponse.ok) {
          const errorData = await loginResponse.json();
          throw new Error(errorData.detail || 'Failed to retrieve patient information');
        }

        const loginData = await loginResponse.json();
        setPatientInfo(loginData.patient_info);
        setIsAuthenticated(true);
        
        // Store token for future requests
        localStorage.setItem('patient_token', loginData.access_token);
        
        // Notify Navbar of login status change
        window.dispatchEvent(new Event('loginStatusChanged'));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPatientInfo(null);
    setAuthForm({
        mediconnect_username: '',
        password: '',
        driver_license_id: ''
    });
    setError('');
    // Remove patient token from localStorage
    localStorage.removeItem('patient_token');
    
    // Notify Navbar of login status change
    window.dispatchEvent(new Event('loginStatusChanged'));
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const response = await fetch(`${API_BASE}/patient/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deleteForm)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Account deletion failed');
      }

      const result = await response.json();
      alert('Account deleted successfully. You will be redirected to the login page.');
      
      // Clear all data and redirect
      localStorage.removeItem('patient_token');
      // Notify Navbar of login status change
      window.dispatchEvent(new Event('loginStatusChanged'));
      setIsAuthenticated(false);
      setPatientInfo(null);
      setShowDeleteModal(false);
      setAuthForm({
        mediconnect_username: '',
        password: '',
        driver_license_id: ''
      });
      
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDeleteForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteForm({
      mediconnect_username: '',
      mediconnect_password: '',
      driver_license_id: '',
      delete_prompt: ''
    });
    setDeleteError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAuthentication(e as any);
    }
  };

  if (isAuthenticated && patientInfo) {
    return (
      <>
        <div style={{ 
          minHeight: '100vh', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          paddingTop: '120px',
          padding: '2rem',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}>
        <div style={{ 
          maxWidth: '1000px', 
          margin: '0 auto',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '32px',
          padding: '3rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '3rem'
          }}>
            <h1 style={{ 
              fontSize: '2.5rem', 
              margin: 0,
              color: '#1a365d',
              fontWeight: '700',
              letterSpacing: '-0.025em',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              Patient Information
            </h1>
            <button 
              onClick={handleLogout}
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
              Logout
            </button>
          </div>

          <div style={{ 
            display: 'grid', 
            gap: '2rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))'
          }}>
            {/* Personal Information Card */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.08)';
            }}>
              <h2 style={{ 
                fontSize: '1.5rem', 
                marginBottom: '1.5rem',
                color: '#1e40af',
                fontWeight: '700',
                borderBottom: '3px solid #3b82f6',
                paddingBottom: '0.75rem',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>
                Personal Details
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0'
                }}>
                  <strong style={{ 
                    color: '#475569',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>Full Name:</strong>
                  <p style={{ 
                    margin: '0.5rem 0 0 0', 
                    fontSize: '1.2rem',
                    color: '#1e293b',
                    fontWeight: '500',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>
                    {patientInfo.first_name} {patientInfo.middle_name && `${patientInfo.middle_name} `}{patientInfo.last_name}
                  </p>
                </div>
              </div>
            </div>

            {/* Portal Information Card */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.08)';
            }}>
              <h2 style={{ 
                fontSize: '1.5rem', 
                marginBottom: '1.5rem',
                color: '#059669',
                fontWeight: '700',
                borderBottom: '3px solid #10b981',
                paddingBottom: '0.75rem',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>
                Healthcare Portal
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '16px',
                  border: '1px solid #bbf7d0'
                }}>
                  <strong style={{ 
                    color: '#065f46',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>Provider:</strong>
                  <p style={{ 
                    margin: '0.5rem 0 0 0', 
                    fontSize: '1.2rem',
                    color: '#047857',
                    fontWeight: '500',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>
                    {patientInfo.portal_name}
                  </p>
                </div>
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '16px',
                  border: '1px solid #bbf7d0'
                }}>
                  <strong style={{ 
                    color: '#065f46',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>API Status:</strong>
                  <p style={{ 
                    margin: '0.5rem 0 0 0', 
                    fontSize: '1.2rem',
                    color: '#047857',
                    fontWeight: '500',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '50px',
                      backgroundColor: patientInfo.API === 'true' ? '#dcfce7' : '#fef3c7',
                      color: patientInfo.API === 'true' ? '#166534' : '#92400e',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}>
                      {patientInfo.API === 'true' ? 'Connected' : 'Not Connected'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Authentication Details Card */}
            <div style={{
              backgroundColor: '#ffffff',
              padding: '2rem',
              borderRadius: '24px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
              gridColumn: 'span 2',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.08)';
            }}>
              <h2 style={{ 
                fontSize: '1.5rem', 
                marginBottom: '1.5rem',
                color: '#d97706',
                fontWeight: '700',
                borderBottom: '3px solid #f59e0b',
                paddingBottom: '0.75rem',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>
                Portal Authentication
              </h2>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem'
              }}>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#fffbeb',
                  borderRadius: '16px',
                  border: '1px solid #fed7aa'
                }}>
                  <strong style={{ 
                    color: '#92400e',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>Portal Username:</strong>
                  <p style={{ 
                    margin: '0.75rem 0 0 0', 
                    fontSize: '1.1rem',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    backgroundColor: '#ffffff',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    color: '#374151',
                    fontWeight: '500'
                  }}>
                    {patientInfo.auth_username || 'N/A'}
                  </p>
                </div>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#fffbeb',
                  borderRadius: '16px',
                  border: '1px solid #fed7aa'
                }}>
                  <strong style={{ 
                    color: '#92400e',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  }}>Portal Password:</strong>
                  <p style={{ 
                    margin: '0.75rem 0 0 0', 
                    fontSize: '1.1rem',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    backgroundColor: '#ffffff',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    color: '#374151',
                    fontWeight: '500'
                  }}>
                    {'•'.repeat(patientInfo.auth_password?.length || 8)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Access Information */}
          <div style={{
            marginTop: '3rem',
            padding: '2rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '24px',
            border: '2px solid #bae6fd'
          }}>
            <h3 style={{ 
              margin: '0 0 1rem 0',
              color: '#0c4a6e',
              fontSize: '1.3rem',
              fontWeight: '700',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              Secure Access Granted
            </h3>
            <p style={{ 
              margin: 0,
              color: '#0369a1',
              lineHeight: '1.6',
              fontSize: '1rem',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              Your patient information has been securely retrieved and is displayed above. 
              This data is encrypted and only accessible with proper authentication credentials.
            </p>
          </div>

          {/* Delete Account Section */}
          <div style={{
            marginTop: '3rem',
            padding: '2rem',
            backgroundColor: '#fef2f2',
            borderRadius: '24px',
            border: '2px solid #fecaca'
          }}>
            <h3 style={{ 
              margin: '0 0 1rem 0',
              color: '#dc2626',
              fontSize: '1.3rem',
              fontWeight: '700',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              Account Management
            </h3>
            <p style={{ 
              margin: '0 0 1.5rem 0',
              color: '#b91c1c',
              lineHeight: '1.6',
              fontSize: '1rem',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              <strong>Warning:</strong> Deleting your account will permanently remove all your medical information from our system. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '16px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 20px rgba(220, 38, 38, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#b91c1c';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(220, 38, 38, 0.3)';
              }}
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '2rem',
            maxWidth: '420px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
            margin: 'auto'
          }}>
            <h2 style={{
              color: '#dc2626',
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1rem',
              textAlign: 'center',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
            }}>
              ⚠️ Delete Account
            </h2>
            
            <div style={{
              padding: '1rem',
              backgroundColor: '#fef2f2',
              borderRadius: '12px',
              border: '2px solid #fecaca',
              marginBottom: '1.5rem'
            }}>
              <p style={{
                margin: 0,
                color: '#dc2626',
                fontWeight: '600',
                fontSize: '0.9rem',
                lineHeight: '1.4',
                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
              }}>
                <strong>WARNING:</strong> This action is permanent and cannot be undone. All your medical information will be permanently deleted from our system.
              </p>
            </div>

            <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  MediConnect Username
                </label>
                <input
                  type="text"
                  name="mediconnect_username"
                  value={deleteForm.mediconnect_username}
                  onChange={handleDeleteFormChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Enter your username"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#dc2626';
                    e.target.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, 0.1)';
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
                  marginBottom: '0.5rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  Password
                </label>
                <input
                  type="password"
                  name="mediconnect_password"
                  value={deleteForm.mediconnect_password}
                  onChange={handleDeleteFormChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Enter your password"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#dc2626';
                    e.target.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, 0.1)';
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
                  marginBottom: '0.5rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  Driver License ID
                </label>
                <input
                  type="text"
                  name="driver_license_id"
                  value={deleteForm.driver_license_id}
                  onChange={handleDeleteFormChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Enter your driver license ID"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#dc2626';
                    e.target.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, 0.1)';
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
                  marginBottom: '0.5rem',
                  color: '#374151',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  Type "DELETE ACCOUNT" to confirm
                </label>
                <input
                  type="text"
                  name="delete_prompt"
                  value={deleteForm.delete_prompt}
                  onChange={handleDeleteFormChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontSize: '0.9rem',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    outline: 'none'
                  }}
                  placeholder="Type DELETE ACCOUNT"
                  onFocus={(e) => {
                    e.target.style.borderColor = '#dc2626';
                    e.target.style.boxShadow = '0 0 0 4px rgba(220, 38, 38, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {deleteError && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#fef2f2',
                  border: '2px solid #fecaca',
                  borderRadius: '12px',
                  color: '#dc2626',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                }}>
                  {deleteError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4b5563';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#6b7280';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || deleteForm.delete_prompt !== 'DELETE ACCOUNT'}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (deleteLoading || deleteForm.delete_prompt !== 'DELETE ACCOUNT') ? '#9ca3af' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    cursor: (deleteLoading || deleteForm.delete_prompt !== 'DELETE ACCOUNT') ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!deleteLoading && deleteForm.delete_prompt === 'DELETE ACCOUNT') {
                      e.currentTarget.style.backgroundColor = '#b91c1c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!deleteLoading && deleteForm.delete_prompt === 'DELETE ACCOUNT') {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                    }
                  }}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
    );
  }

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
        maxWidth: '450px',
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
          Patient Access
        </h1>
        
        <form onSubmit={handleAuthentication} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
              value={authForm.mediconnect_username}
              onChange={handleInputChange}
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
              placeholder="Enter your username"
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
              name="password"
              value={authForm.password}
              onChange={handleInputChange}
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
              value={authForm.driver_license_id}
              onChange={handleInputChange}
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
              placeholder="Enter your driver license ID"
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
            {loading ? 'Authenticating...' : 'Access Patient Information'}
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
            <strong>Secure Access:</strong> Please provide your MediConnect username, password, and driver license ID to access your patient information securely.
          </p>
        </div>
      </div>
    </div>
  );
}