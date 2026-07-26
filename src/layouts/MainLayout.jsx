import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

function MainLayout() {
  const isImpersonating = Boolean(localStorage.getItem("adminBackupToken"));
  
  const currentUser = (() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (rawUser && rawUser !== "undefined") {
        return JSON.parse(rawUser);
      }
      return null;
    } catch {
      return null;
    }
  })();

  const handleReturnToAdmin = () => {
    const adminToken = localStorage.getItem("adminBackupToken");
    const adminUser = localStorage.getItem("adminBackupUser");
    
    if (adminToken && adminUser) {
      localStorage.setItem("token", adminToken);
      localStorage.setItem("user", adminUser);
      localStorage.removeItem("adminBackupToken");
      localStorage.removeItem("adminBackupUser");
      
      alert("Returned to Administrator session.");
      window.location.href = "/admin";
    }
  };

  return (
    <>
      {isImpersonating && currentUser && (
        <div
          style={{
            background: "linear-gradient(90deg, #b91c1c, #dc2626)",
            color: "#ffffff",
            padding: "8px 16px",
            textAlign: "center",
            fontSize: "0.85rem",
            fontWeight: "600",
            position: "sticky",
            top: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
          }}
        >
          <span>🌐 Impersonating: <strong>{currentUser.name}</strong> ({currentUser.role.toUpperCase()})</span>
          <button
            onClick={handleReturnToAdmin}
            style={{
              background: "#ffffff",
              color: "#b91c1c",
              border: "none",
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: "700",
              cursor: "pointer",
              transition: "opacity 0.2s"
            }}
            onMouseEnter={(e) => e.target.style.opacity = "0.9"}
            onMouseLeave={(e) => e.target.style.opacity = "1"}
          >
            Return to Admin
          </button>
        </div>
      )}
      <Navbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">CivicPulse</div>
          <div className="footer-links">
            <a href="/" className="footer-link">Dashboard</a>
            <a href="/report" className="footer-link">File Report</a>
          </div>
          <div className="footer-copy">
            &copy; {new Date().getFullYear()} CivicPulse. All rights reserved. Registered municipal issue reporting service.
          </div>
        </div>
      </footer>
    </>
  );
}

export default MainLayout;