import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Navbar() {
  const navigate = useNavigate();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const [usersByRole, setUsersByRole] = useState({
    moderator: [],
    staff: [],
    citizen: [],
    admin: [],
  });
  const [incidentContext, setIncidentContext] = useState({});

  const token = localStorage.getItem("token");

  let userName = "";
  let currentUser = null;
  try {
    const rawUser = localStorage.getItem("user");
    if (rawUser && rawUser !== "undefined") {
      currentUser = JSON.parse(rawUser);
    }
    if (currentUser && currentUser.name) userName = currentUser.name;
  } catch {
    userName = "";
    currentUser = null;
  }

  const userInitial = userName ? userName.charAt(0).toUpperCase() : "?";

  const isAdminOrImpersonating =
    Boolean(currentUser && currentUser.role === "admin") || Boolean(localStorage.getItem("adminBackupToken"));

  const moderatorsList = Array.isArray(usersByRole?.moderator) ? usersByRole.moderator : [];
  const staffList = Array.isArray(usersByRole?.staff) ? usersByRole.staff : [];
  const citizenList = Array.isArray(usersByRole?.citizen) ? usersByRole.citizen : [];
  const adminList = Array.isArray(usersByRole?.admin) ? usersByRole.admin : [];

  // Fetch all active users grouped by role + incident context
  const fetchActiveRoles = async () => {
    try {
      const res = await api.get("/api/auth/active-roles");
      if (res.data.usersByRole) {
        setUsersByRole({
          moderator: res.data.usersByRole.moderator || [],
          staff: res.data.usersByRole.staff || [],
          citizen: res.data.usersByRole.citizen || [],
          admin: res.data.usersByRole.admin || [],
        });
      }
      if (res.data.incidentContext) {
        setIncidentContext(res.data.incidentContext || {});
      }
    } catch (err) {
      console.error("Error fetching active roles:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchActiveRoles();
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("adminBackupToken");
    localStorage.removeItem("adminBackupUser");
    navigate("/login");
  };

  const handleSwitchToUser = async ({ userId, role }) => {
    setSwitchOpen(false);
    try {
      setSwitching(true);
      const res = await api.post("/api/auth/switch-role", { userId, role });

      // Save switched user token & profile to local storage
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      // Direct page navigation for each role
      const targetPaths = {
        citizen: "/",
        moderator: "/moderator",
        staff: "/staff",
        admin: "/admin",
      };

      window.location.href = targetPaths[res.data.user.role] || "/";
    } catch (err) {
      console.error("Role switch error:", err);
      alert(err.response?.data?.message || `Failed to switch session.`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span />
          CivicPulse
        </Link>

        <div className="navbar-links">
          <Link to="/" className="nav-link">
            Dashboard
          </Link>
          <Link to="/leaderboard" className="nav-link" style={{ marginRight: "12px" }}>
            🏆 Leaderboard
          </Link>

          {/* Switch Dashboard Dropdown Button */}
          {token && (
            <div style={{ position: "relative", display: "inline-block", marginRight: "12px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSwitchOpen(!switchOpen);
                  if (!switchOpen) fetchActiveRoles();
                }}
                disabled={switching}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(99, 102, 241, 0.15)",
                  border: "1px solid var(--accent-primary)",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                <span>🔀 Switch Dashboard</span>
                <span style={{ fontSize: "0.7rem", transition: "transform 0.2s", transform: switchOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
              </button>

              {switchOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "6px",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "10px",
                    boxShadow: "0 14px 35px rgba(0,0,0,0.6)",
                    zIndex: 10000,
                    minWidth: "280px",
                    maxHeight: "420px",
                    overflowY: "auto",
                    padding: "8px 0"
                  }}
                >
                  {/* Moderators Section */}
                  <div style={{ padding: "6px 14px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-primary)" }}>
                    🛡️ Moderators
                  </div>
                  {moderatorsList.length === 0 ? (
                    <div style={{ padding: "6px 14px", fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>No moderator accounts</div>
                  ) : (
                    moderatorsList.map((u) => {
                      const isHandling = incidentContext.assigneeId === u._id;
                      const isCurrent = currentUser?.id === u._id || currentUser?._id === u._id;
                      return (
                        <div
                          key={u._id}
                          onClick={() => handleSwitchToUser({ userId: u._id })}
                          style={{
                            padding: "8px 14px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            color: isCurrent ? "var(--accent-primary)" : "var(--text-primary)",
                            background: isCurrent ? "rgba(99, 102, 241, 0.1)" : "transparent",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                          onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                          onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div>
                            <strong>{u.name}</strong> {isCurrent && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>(Active)</span>}
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                          {isHandling && (
                            <span style={{ fontSize: "0.68rem", background: "rgba(34, 197, 94, 0.15)", color: "var(--accent-success)", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                              Handling Task
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}

                  <div style={{ borderTop: "1px solid var(--border-color)", margin: "6px 0" }} />

                  {/* Staff Section */}
                  <div style={{ padding: "6px 14px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-success)" }}>
                    🛠️ Staff / Field Crew
                  </div>
                  {staffList.length === 0 ? (
                    <div style={{ padding: "6px 14px", fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>No staff accounts</div>
                  ) : (
                    staffList.map((u) => {
                      const isAssigned = incidentContext.assigneeId === u._id;
                      const isCurrent = currentUser?.id === u._id || currentUser?._id === u._id;
                      return (
                        <div
                          key={u._id}
                          onClick={() => handleSwitchToUser({ userId: u._id })}
                          style={{
                            padding: "8px 14px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            color: isCurrent ? "var(--accent-success)" : "var(--text-primary)",
                            background: isCurrent ? "rgba(34, 197, 94, 0.1)" : "transparent",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                          onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                          onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div>
                            <strong>{u.name}</strong> {isCurrent && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>(Active)</span>}
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                          {isAssigned && (
                            <span style={{ fontSize: "0.68rem", background: "rgba(34, 197, 94, 0.15)", color: "var(--accent-success)", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                              Assigned Task
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}

                  <div style={{ borderTop: "1px solid var(--border-color)", margin: "6px 0" }} />

                  {/* Citizens Section */}
                  <div style={{ padding: "6px 14px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
                    👤 Citizens
                  </div>
                  {citizenList.length === 0 ? (
                    <div style={{ padding: "6px 14px", fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>No citizen accounts</div>
                  ) : (
                    citizenList.map((u) => {
                      const isReporter = incidentContext.reporterId === u._id;
                      const isCurrent = currentUser?.id === u._id || currentUser?._id === u._id;
                      return (
                        <div
                          key={u._id}
                          onClick={() => handleSwitchToUser({ userId: u._id })}
                          style={{
                            padding: "8px 14px",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            color: isCurrent ? "var(--text-primary)" : "var(--text-primary)",
                            background: isCurrent ? "rgba(255, 255, 255, 0.08)" : "transparent",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                          onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                          onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                        >
                          <div>
                            <strong>{u.name}</strong> {isCurrent && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>(Active)</span>}
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                          {isReporter && (
                            <span style={{ fontSize: "0.68rem", background: "rgba(99, 102, 241, 0.15)", color: "var(--accent-primary)", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                              Reporter
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Admins Section */}
                  {adminList.length > 0 && (
                    <>
                      <div style={{ borderTop: "1px solid var(--border-color)", margin: "6px 0" }} />
                      <div style={{ padding: "6px 14px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-danger)" }}>
                        👑 Admins
                      </div>
                      {adminList.map((u) => {
                        const isCurrent = currentUser?.id === u._id || currentUser?._id === u._id;
                        return (
                          <div
                            key={u._id}
                            onClick={() => handleSwitchToUser({ userId: u._id })}
                            style={{
                              padding: "8px 14px",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              color: "var(--accent-danger)",
                              background: isCurrent ? "rgba(239, 68, 68, 0.1)" : "transparent",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}
                            onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                            onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                          >
                            <div>
                              <strong>{u.name}</strong> {isCurrent && <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>(Active)</span>}
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{u.email}</div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {token ? (
            <>
              {currentUser && (
                <>
                  {currentUser.role === "moderator" && (
                    <Link to="/moderator" className="nav-link" style={{ marginRight: "12px" }}>
                      Moderate
                    </Link>
                  )}
                  {["staff", "moderator"].includes(currentUser.role) && (
                    <Link to="/staff" className="nav-link" style={{ marginRight: "12px" }}>
                      Tasks
                    </Link>
                  )}
                  {currentUser.role === "admin" && (
                    <Link to="/admin" className="nav-link" style={{ marginRight: "12px" }}>
                      Admin
                    </Link>
                  )}
                </>
              )}
              {(!currentUser || currentUser.role === "citizen") && (
                <Link to="/report" className="btn btn-primary btn-sm">
                  Report Issue
                </Link>
              )}

              <div className="nav-user">
                <div className="nav-avatar">{userInitial}</div>
                {userName && <span className="nav-username">{userName}</span>}
              </div>

              <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Sign In
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;