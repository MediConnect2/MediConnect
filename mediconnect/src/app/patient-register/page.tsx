'use client'

import { useState } from 'react';

export default function PatientRegisterPage(){
    const [form,setForm] = useState({
        mediconnect_username:'',
        password:'',
        first_name:'',
        middle_name:'',
        last_name:'',
        driver_license_id:'',
        portal_username:'',
        portal_password:'',
        provider_portal_name:'',
        use_fingerprint: false,
        fingerprint_data: ''
    });

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target;

        // Fields to force lowercase
        const lowercaseFields = ['mediconnect_username', 'first_name', 'middle_name', 'last_name', 'portal_username'];

        // If the field is driver_license_id, allow only numbers
        if (name === 'driver_license_id') {
            // Remove non-digit characters
            const numericValue = value.replace(/\D/g, '');
            setForm({ ...form, [name]: numericValue });
            return;
        }

        setForm({
            ...form,
            [name]: type === 'checkbox' ? checked :
                    lowercaseFields.includes(name) ? value.toLowerCase() :
                    value
        });
};

    
    const handleSubmit = async()=>{
        const res = await fetch('http://localhost:8000/register',{
            method:'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(form)
        });
        
        if (res.ok){ alert("Patient Registered Successfully! Welcome " + form.first_name + " " + form.last_name); }
        else { alert("Error during Registration"); }
    };

  return (
    <div style={{ padding: 20 }}>
      <h2>Patient Registration</h2>
      {[
        'mediconnect_username',
        'password',
        'first_name',
        'middle_name',
        'last_name',
        'driver_license_id',
        'portal_username',
        'portal_password',
        'provider_portal_name',
        'fingerprint_data'
      ].map((field) => (
        <div key={field}>
          <label>{field}</label><br />
          <input
            type="text"
            name={field}
            value={(form as any)[field]}
            onChange={handleChange}
          />
          <br />
        </div>
      ))}
      <label>
        Use Fingerprint Login
        <input
          type="checkbox"
          name="use_fingerprint"
          checked={form.use_fingerprint}
          onChange={handleChange}
        />
      </label><br /><br />
      <button onClick={handleSubmit}>Register</button>
    </div>
  );
}