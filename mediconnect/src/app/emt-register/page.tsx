'use client';

import { useState } from 'react';

export default function EMTRegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    middle_name: '',
    last_name: ''
  });

  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await fetch('http://127.0.0.1:8000/emt/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Registration failed');
      }

      setMessage('Registration successful!');
      setFormData({
        username: '',
        password: '',
        first_name: '',
        middle_name: '',
        last_name: ''
      });
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: 'auto', paddingTop: '3rem' }}>
      <h2>EMT Registration</h2>
      <form onSubmit={handleSubmit}>
        <input name="username" placeholder="Username" value={(formData.username ?? "").toLowerCase()} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
        <input name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} required />
        <input name="middle_name" placeholder="Middle Name (optional)" value={formData.middle_name} onChange={handleChange} />
        <input name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} required />
        <button type="submit">Register EMT</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
