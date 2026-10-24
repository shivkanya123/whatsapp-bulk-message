
import { useState } from "react";

function Register({ onRegisterSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Registration failed"
        );
      }

      // Save registration status only after API success
      localStorage.setItem("isRegistered", "true");
      localStorage.setItem("registeredEmail", email);

      setMessage("Registration Successful!");

      setName("");
      setEmail("");
      setPassword("");

      // Open dashboard
      if (typeof onRegisterSuccess === "function") {
        onRegisterSuccess();
      }
    } catch (error) {
      setMessage(error.message || "Backend connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "60px auto",
        padding: "30px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        fontFamily: "Arial",
        background: "#fff",
      }}
    >
      <h2>Create Account</h2>
      <p>WhatsApp Bulk Messaging</p>

      <form onSubmit={handleRegister}>
        <input
          style={inputStyle}
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          style={inputStyle}
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          style={inputStyle}
          type="password"
          placeholder="Password (minimum 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: "#128C7E",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      {message && (
        <p
          role="status"
          style={{
            color: message === "Registration Successful!"
              ? "green"
              : "red",
            marginTop: "15px",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  marginBottom: "15px",
  border: "1px solid #ccc",
  borderRadius: "6px",
};

export default Register;
