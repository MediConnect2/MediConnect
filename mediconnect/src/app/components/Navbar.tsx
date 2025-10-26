'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Navbar() {
    const router = useRouter();
    const pathname = usePathname();
    const [isHospitalLoggedIn, setIsHospitalLoggedIn] = useState(false);
    const [isEmtLoggedIn, setIsEmtLoggedIn] = useState(false);
    const [isPatientLoggedIn, setIsPatientLoggedIn] = useState(false);

    useEffect(() => {
        // Check login status for all accounts
        const checkLoginStatus = () => {
            const hospitalToken = localStorage.getItem('hospital_token');
            const emtToken = localStorage.getItem('emt_token');
            const patientToken = localStorage.getItem('patient_token');
            setIsHospitalLoggedIn(!!hospitalToken);
            setIsEmtLoggedIn(!!emtToken);
            setIsPatientLoggedIn(!!patientToken);
        };

        checkLoginStatus();

        // Listen for custom login status change event, storage changes (other tabs), and window focus
        const handleLoginStatusChange = () => checkLoginStatus();
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'hospital_token' || e.key === 'emt_token' || e.key === 'patient_token') {
                checkLoginStatus();
            }
        };
        const handleWindowFocus = () => checkLoginStatus();

        window.addEventListener('loginStatusChanged', handleLoginStatusChange);
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.removeEventListener('loginStatusChanged', handleLoginStatusChange);
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, []);

    const isAnyLoggedIn = isHospitalLoggedIn || isEmtLoggedIn || isPatientLoggedIn;

    const handleHospitalLogout = () => {
        // Remove hospital token from localStorage
        localStorage.removeItem('hospital_token');
        setIsHospitalLoggedIn(false);
        // Notify other parts of the app that login status changed
        window.dispatchEvent(new Event('loginStatusChanged'));
        router.push('/hospital-login');
    };

    const handleLockedButtonClick = (account?: string) => {
        const acct = account ?? 'that account';
        alert(`Please log out first to login as "${acct}".`);
    };

    const navItems = [
        {
            href: '/',
            label: 'EMT Access'
        },
        {
            href: isHospitalLoggedIn ? '/patient-register' : '/hospital-login',
            label: isHospitalLoggedIn ? 'Patient Register' : 'Hospital Login'
        },
        {
            href: '/patient-access',
            label: 'Patient Access'
        }
    ];

    return (
        <nav style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
            zIndex: 1000,
            padding: '1rem 2rem',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.05)'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                maxWidth: '1200px',
                margin: '0 auto'
            }}>
                {/* Logo */}
                <Link 
                    href="/" 
                    style={{
                        fontSize: '1.75rem',
                        fontWeight: '700',
                        color: '#1a365d',
                        textDecoration: 'none',
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        letterSpacing: '-0.025em'
                    }}
                >
                    MediConnect
                </Link>

                {/* Navigation Links */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                }}>
                    {navItems.map((item) => (
                        isAnyLoggedIn ? (
                            <button
                                key={item.href}
                                onClick={() => {
                                    const acct = item.href === '/'
                                        ? 'EMT'
                                        : item.href === '/patient-access'
                                            ? 'Patient'
                                            : 'Hospital';
                                    handleLockedButtonClick(acct);
                                }}
                                style={{
                                    color: '#64748b',
                                    textDecoration: 'none',
                                    fontWeight: '500',
                                    fontSize: '0.95rem',
                                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '50px',
                                    backgroundColor: 'transparent',
                                    border: '1px solid rgba(100, 116, 139, 0.2)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'not-allowed',
                                    opacity: 0.6
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f8fafc';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                                    e.currentTarget.style.transform = 'translateY(0px)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {item.label} 🔒
                            </button>
                        ) : (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    color: pathname === item.href ? '#ffffff' : '#64748b',
                                    textDecoration: 'none',
                                    fontWeight: '500',
                                    fontSize: '0.95rem',
                                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '50px',
                                    backgroundColor: pathname === item.href ? '#3b82f6' : 'transparent',
                                    border: '1px solid',
                                    borderColor: pathname === item.href ? '#3b82f6' : 'rgba(100, 116, 139, 0.2)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: pathname === item.href ? '0 4px 20px rgba(59, 130, 246, 0.3)' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                    if (pathname !== item.href) {
                                        e.currentTarget.style.backgroundColor = '#f8fafc';
                                        e.currentTarget.style.borderColor = '#3b82f6';
                                        e.currentTarget.style.color = '#3b82f6';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (pathname !== item.href) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                                        e.currentTarget.style.color = '#64748b';
                                        e.currentTarget.style.transform = 'translateY(0px)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }
                                }}
                            >
                                {item.label}
                            </Link>
                        )
                    ))}

                    {/* Hospital Logout Button */}
                    {isHospitalLoggedIn && (
                        <button
                            onClick={handleHospitalLogout}
                            style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: '1px solid #ef4444',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '50px',
                                fontSize: '0.95rem',
                                fontWeight: '500',
                                fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                cursor: 'pointer',
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
                    )}

                </div>
            </div>

            {/* Mobile responsive styles */}
            <style jsx>{`
                @media (max-width: 768px) {
                    nav > div {
                        flex-direction: column;
                        gap: 1rem;
                    }
                    
                    nav > div > div {
                        flex-wrap: wrap;
                        justify-content: center;
                        gap: 0.5rem;
                    }
                }
            `}</style>
        </nav>
    );
}