'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EMTLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [result, setResult] = useState('');
    const router = useRouter();

    const handleLogin = async () => {
        try {
            const response = await fetch('http://localhost:8000/emt/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.toLowerCase(), password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Login failed');
            }

            const data = await response.json();
            setResult('');
            router.push('/patient-login');  // Redirect
            alert('Login successful! Welcome '+data['first_name']+" "+data['last_name']);  // Notify user
        } catch (error: any) {
            setResult(`Error: ${error.message}`);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleLogin();
    };

    return (
        <div style={{ padding: 20 }}>
            <h1>EMT Login</h1>
            <input
                placeholder="EMT_Username"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                onKeyDown={handleKeyDown}
                style={{ display: 'block', marginBottom: 10 }}
            />
            <input
                placeholder="EMT_Password"
                value={password}
                type="password"
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ display: 'block', marginBottom: 10 }}
            />
            <button onClick={handleLogin}>Login</button>
            <pre>{result}</pre>
        </div>
    );
}
