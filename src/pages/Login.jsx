import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import authIllustration from "../assets/auth_illustration.png";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
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
      const response = await api.post("/api/auth/login", formData);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      navigate("/");
    } catch (error) {
      setError(error.response?.data?.message || "Login failed");
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
            <h1>Sign in to CivicPulse</h1>
            <p>Enter your credentials to access your account</p>
          </div>

          {error && <div className="auth-error-banner">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
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
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>
              Sign In
            </button>
          </form>

          <div className="auth-footer-text" style={{ textAlign: "left" }}>
            Don't have an account? <Link to="/signup">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;