'use client';
import { useState } from "react";

export default function Dashboard() {
    const [identifier, setIdentifier]= useState('');
    const [result, setResult] = useState('');

    const handleLookup = async () => {
        const res = await fetch('http://localhost:8000/patient-lookup', {
            method: 'POST',
            body: JSON.stringify({ identifier }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (res.ok) {
            const data = await res.json();
            setResult(JSON.stringify(data, null, 2));
        } else {
            alert('Patient not found or error occured');
        }
    };

    return (
        <main style = {{ padding: '2rem' }}>
            <h1>Patient Lookup</h1>
            <input
                type="text"
                placeholder="Enter Patient Identifier"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                style={{ display: 'block', marginBottom: '1rem' }}
            />
            <button onClick={handleLookup}>Lookup</button>
            {result && (
                <pre
                    style = {{
                        background: '#f4f4f4',
                        padding: '1rem',
                        marginTop: '1rem',
                        borderRadius: '5px'
                    }}
                >
                    {result}
                </pre>
            )}
        </main>
    );
}
