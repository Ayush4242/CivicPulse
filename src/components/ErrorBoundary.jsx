import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CivicPulse Uncaught Error:", error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("adminBackupToken");
    localStorage.removeItem("adminBackupUser");
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          color: "#f4f4f5",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{
            maxWidth: "480px",
            width: "100%",
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "12px",
            padding: "32px",
            textAlign: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
          }}>
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "16px" }}>⚠️</span>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "1.25rem", fontWeight: 700 }}>Something went wrong</h2>
            <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginBottom: "20px", lineHeight: 1.5 }}>
              An unexpected render error occurred. Click below to clear local session cache and reload CivicPulse.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "#3b82f6",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                🔄 Refresh Page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  background: "#27272a",
                  color: "#f4f4f5",
                  border: "1px solid #3f3f46",
                  padding: "10px 18px",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                🚪 Reset Session & Go Home
              </button>
            </div>
            {this.state.error?.message && (
              <pre style={{
                marginTop: "20px",
                padding: "12px",
                background: "#09090b",
                borderRadius: "6px",
                color: "#ef4444",
                fontSize: "0.75rem",
                overflowX: "auto",
                textAlign: "left"
              }}>
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
