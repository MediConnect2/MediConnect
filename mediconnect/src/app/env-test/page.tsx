'use client';

import { useEffect } from 'react';

export default function EnvTest() {
    useEffect(() => {
        console.log('NEXT_PUBLIC_API_BASE:', process.env.NEXT_PUBLIC_API_BASE);
        console.log('All env vars:', Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC')));
    }, []);

    return (
        <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
            <h1>Environment Variable Test</h1>
            <p><strong>NEXT_PUBLIC_API_BASE:</strong> {process.env.NEXT_PUBLIC_API_BASE || 'NOT SET'}</p>
            <p><strong>Default fallback:</strong> https://localhost:8000</p>
            
            <hr style={{ margin: '2rem 0' }} />
            
            <h2>Test API Calls:</h2>
            <button 
                onClick={() => {
                    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://localhost:8000';
                    console.log('Would call:', `${API_BASE}/verify-hospital-token`);
                    alert(`Would call: ${API_BASE}/verify-hospital-token`);
                }}
                style={{
                    padding: '1rem 2rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                }}
            >
                Test API_BASE Variable
            </button>
            
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px' }}>
                <p><strong>Instructions:</strong></p>
                <ol>
                    <li>Check the value above</li>
                    <li>It should show: <code>https://localhost:8000</code></li>
                    <li>If it shows "NOT SET", the .env.local file isn't being loaded</li>
                    <li>Click the button to verify the variable is accessible in code</li>
                </ol>
            </div>
        </div>
    );
}
