"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientLoginPage() {
  const [formData, setFormData] = useState({
    mediconnect_username: "",
    password: "",
    first_name: "",
    last_name: "",
    driver_license_id: "",
    fingerprint_data: "",
  });

  const [error, setError] = useState("");
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const isValid = () => {
    const { mediconnect_username, password, first_name, last_name, driver_license_id, fingerprint_data } = formData;

    return (
      (mediconnect_username && password) ||
      (first_name && last_name && driver_license_id) ||
      fingerprint_data
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValid()) {
      setError("Please enter sufficient login credentials.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:8000/patient/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Login successful! Welcome ${data.first_name} ${data.last_name}`);
        // Redirect or handle patient data
        // e.g. router.push("/patient-dashboard");
      } else {
        const err = await response.json();
        alert(`Login failed: ${err.detail || "Unknown error"}`);
      }
    } catch (err) {
      setError("Server error during login.");
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: "500px", margin: "0 auto" }}>
      <h1>Patient Login</h1>
      <form onSubmit={handleSubmit}>
        <h3>MediConnect Credentials</h3>
        <input
          type="text"
          name="mediconnect_username"
          placeholder="MediConnect Username"
          value={formData.mediconnect_username}
          onChange={handleChange}
        />
        <input
          type="password"
          name="password"
          placeholder="MediConnect Password"
          value={formData.password}
          onChange={handleChange}
        />

        <h3>Name & Driver License</h3>
        <input
          type="text"
          name="first_name"
          placeholder="First Name"
          value={formData.first_name}
          onChange={handleChange}
        />
        <input
          type="text"
          name="last_name"
          placeholder="Last Name"
          value={formData.last_name}
          onChange={handleChange}
        />
        <input
          type="text"
          name="driver_license_id"
          placeholder="Driver License ID"
          value={formData.driver_license_id}
          onChange={handleChange}
        />

        <h3>Fingerprint Login (Coming soon)</h3>
        <input
          type="text"
          name="fingerprint_data"
          placeholder="Paste fingerprint hash (test only)"
          value={formData.fingerprint_data}
          onChange={handleChange}
        />

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="submit" disabled={!isValid()} style={{ marginTop: "20px" }}>
          Login
        </button>
      </form>
    </div>
  );
}
