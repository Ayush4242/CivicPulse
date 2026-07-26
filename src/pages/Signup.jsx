import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import authIllustration from "../assets/auth_illustration.png";

function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "citizen",
  });

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await api.post("/api/auth/register", formData);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      navigate("/");
    } catch (error) {
      setError(error.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-split-grid">
        {/* Left Side Illustration */}
        <div className="auth-illustration-side">
          <h2>Civic Action</h2>
          <p>Join citizens in identifying, voting on, and tracking resolution of municipal infrastructure issues.</p>
          <img src={authIllustration} alt="Civic action collaboration illustration" />
        </div>

        {/* Right Side Form */}
        <div className="auth-panel">
          <div className="auth-header" style={{ textAlign: "left" }}>
            <h1>Create an account</h1>
            <p>Register to report and track local infrastructure issues</p>
          </div>

          {error && <div className="auth-error-banner">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                className="form-input"
                type="email"
                name="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                name="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                minLength="6"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Account Type</label>
              <select
                className="form-select"
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="citizen">Citizen</option>
                <option value="staff">Staff / Field Crew</option>
                <option value="moderator">Moderator</option>
                <option value="admin">System Admin</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>
              Create Account
            </button>
          </form>

          <div className="auth-footer-text" style={{ textAlign: "left" }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;