import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// Import the sub-dashboards for inline simulation
import Home from "./Home";
import ModeratorDashboard from "./ModeratorDashboard";
import StaffDashboard from "./StaffDashboard";

function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [selectedRole, setSelectedRole] = useState("moderator");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Simulation state
  const [simulatedUser, setSimulatedUser] = useState(null);

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "citizen", reputation: 0 });
  const [editLoading, setEditLoading] = useState(false);

  // Delete Confirmation State
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  })();

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [usersRes, incidentsRes] = await Promise.all([
        api.get("/api/auth/users"),
        api.get("/api/incidents")
      ]);
      setUsers(usersRes.data.users || []);
      setIncidents(incidentsRes.data.incidents || []);
    } catch (err) {
      console.error("Error loading admin data:", err);
      setError(err.response?.data?.message || "Failed to load database records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== "admin") {
      navigate("/");
      return;
    }
    loadData();
  }, [navigate]);

  const startSimulation = async (user) => {
    try {
      setError("");
      const res = await api.post("/api/auth/users/impersonate", { userId: user._id });
      
      // Store current admin credentials if not already impersonating
      if (!localStorage.getItem("adminBackupToken")) {
        localStorage.setItem("adminBackupToken", localStorage.getItem("token"));
        localStorage.setItem("adminBackupUser", localStorage.getItem("user"));
      }

      // Set simulated session in localStorage
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      
      // Update simulated user state to render the dashboard
      setSimulatedUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to launch simulated dashboard.");
    }
  };

  const stopSimulation = () => {
    const adminToken = localStorage.getItem("adminBackupToken");
    const adminUser = localStorage.getItem("adminBackupUser");

    if (adminToken && adminUser) {
      localStorage.setItem("token", adminToken);
      localStorage.setItem("user", adminUser);
      localStorage.removeItem("adminBackupToken");
      localStorage.removeItem("adminBackupUser");
    }
    setSimulatedUser(null);
    loadData();
  };

  // Open Edit Modal
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "citizen",
      reputation: user.reputation || 0,
    });
    setError("");
  };

  // Submit Edit User
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setEditLoading(true);
      setError("");
      await api.put(`/api/auth/users/${editingUser._id}`, editForm);
      setSuccessMsg(`Account for "${editForm.name}" updated successfully.`);
      setEditingUser(null);
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("User update error:", err);
      setError(err.response?.data?.message || "Failed to update user profile.");
    } finally {
      setEditLoading(false);
    }
  };

  // Delete User
  const confirmDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      setDeleteLoading(true);
      setError("");
      await api.delete(`/api/auth/users/${deletingUser._id}`);
      setSuccessMsg(`Account for "${deletingUser.name}" has been permanently deleted.`);
      setDeletingUser(null);
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("User delete error:", err);
      setError(err.response?.data?.message || "Failed to delete user account.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Helper to compute live status for a user
  const getUserStatus = (user) => {
    const userIdStr = user._id.toString();

    if (user.role === "citizen") {
      const myIncidents = incidents.filter(
        (inc) => inc.reportedBy?._id === userIdStr || inc.reportedBy === userIdStr
      );
      if (myIncidents.length === 0) return "Active citizen (No reports filed yet)";
      
      const resolving = myIncidents.find((inc) => ["assigned", "in_progress"].includes(inc.status));
      if (resolving) {
        return `Problem '${resolving.title}' is being resolved at present`;
      }
      
      const resolved = myIncidents.find((inc) => inc.status === "resolved");
      if (resolved) {
        return `Reported issue '${resolved.title}' is resolved (awaiting confirmation)`;
      }

      const reported = myIncidents.find((inc) => inc.status === "reported");
      if (reported) {
        return `Reported issue '${reported.title}' (awaiting verification)`;
      }

      return `Reported issue '${myIncidents[0].title}' (${myIncidents[0].status})`;
    }

    if (user.role === "staff") {
      const myTasks = incidents.filter(
        (inc) => inc.assignedTo?._id === userIdStr || inc.assignedTo === userIdStr
      );
      if (myTasks.length === 0) return "Idle field worker / inspector";

      const active = myTasks.find((inc) => inc.staffStatus === "started");
      if (active) {
        return `Active: Currently working on '${active.title}'`;
      }

      const completed = myTasks.find((inc) => inc.staffStatus === "verified" || inc.staffStatus === "completed");
      if (completed) {
        return `Completed work on '${completed.title}' (Awaiting Moderator review)`;
      }

      const assigned = myTasks.find((inc) => inc.staffStatus === "idle");
      if (assigned) {
        return `Assigned: Awaiting start on '${assigned.title}'`;
      }

      return `Assigned to '${myTasks[0].title}' (${myTasks[0].staffStatus})`;
    }

    if (user.role === "moderator") {
      const assignedByMe = incidents.filter((inc) => {
        const lastTimeline = inc.timeline?.[inc.timeline.length - 1];
        return (
          inc.assignedTo &&
          inc.status === "assigned" &&
          lastTimeline?.updatedBy?._id === userIdStr
        );
      });

      if (assignedByMe.length > 0) {
        const inc = assignedByMe[0];
        return `Asked for verification/work from ${inc.assignedTo?.name || "staff"} on '${inc.title}'`;
      }

      return "Active moderator";
    }

    return "System Administrator";
  };

  // Filter users by selected role
  const filteredUsers = users.filter((u) => u.role === selectedRole);

  if (simulatedUser) {
    return (
      <div>
        {/* Floating Simulation Header */}
        <div
          style={{
            background: "linear-gradient(90deg, #1e1b4b, #312e81)",
            borderBottom: "2px solid var(--accent-primary)",
            color: "#ffffff",
            padding: "12px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 10000,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "1.2rem" }}>🌐</span>
            <div>
              <span style={{ fontSize: "0.8rem", textTransform: "uppercase", tracking: "0.05em", color: "var(--accent-primary)", fontWeight: 700 }}>
                Simulating Account Dashboard
              </span>
              <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>
                {simulatedUser.name} <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 400 }}>({simulatedUser.email})</span>
              </h4>
            </div>
          </div>
          <button
            onClick={stopSimulation}
            className="btn btn-primary btn-sm"
            style={{ background: "var(--accent-danger)", border: "none", display: "flex", alignItems: "center", gap: "6px" }}
          >
            ← Close Simulation & Return
          </button>
        </div>

        {/* Render simulated dashboard view inside wrapper */}
        <div style={{ padding: "20px 0" }}>
          {simulatedUser.role === "citizen" && <Home />}
          {simulatedUser.role === "moderator" && <ModeratorDashboard />}
          {simulatedUser.role === "staff" && <StaffDashboard />}
          {simulatedUser.role === "admin" && <div style={{ textAlign: "center", padding: "40px" }}>Cannot simulate admin from within simulation.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="mod-dashboard">
      <div className="mod-dashboard-header">
        <h1>User Management & Control Center</h1>
        <p>Manage, edit, update, or remove account access across citizens, moderators, field staff, and system admins.</p>
      </div>

      {error && <div className="error-wrap">{error}</div>}
      {successMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid var(--accent-success)", color: "var(--accent-success)", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px", fontSize: "0.9rem", fontWeight: 600 }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Role Selection & Actions */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "28px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>Select Account List:</span>
        
        {/* Custom Dropdown Button */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: "260px",
              justifyContent: "space-between",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
              padding: "10px 16px",
              borderRadius: "8px",
              fontSize: "0.9rem",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            <span>
              {selectedRole === "moderator" && "👥 Moderators"}
              {selectedRole === "citizen" && "👤 Citizens"}
              {selectedRole === "staff" && "🛠️ Staff / Field Inspectors"}
              {selectedRole === "admin" && "👑 System Administrators"}
            </span>
            <span style={{ fontSize: "0.75rem", transition: "transform 0.2s", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
          </button>

          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "6px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                zIndex: 1000,
                overflow: "hidden"
              }}
            >
              {[
                { value: "moderator", label: "👥 Moderators" },
                { value: "citizen", label: "👤 Citizens" },
                { value: "staff", label: "🛠️ Staff / Field Inspectors" },
                { value: "admin", label: "👑 System Administrators" }
              ].map((option) => (
                <div
                  key={option.value}
                  onClick={() => {
                    setSelectedRole(option.value);
                    setDropdownOpen(false);
                  }}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    color: selectedRole === option.value ? "var(--accent-primary)" : "var(--text-primary)",
                    background: selectedRole === option.value ? "rgba(99, 102, 241, 0.1)" : "transparent",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedRole !== option.value) {
                      e.target.style.background = "rgba(255, 255, 255, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedRole !== option.value) {
                      e.target.style.background = "transparent";
                    }
                  }}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} style={{ height: "41px" }}>
          🔄 Refresh List
        </button>

        <div style={{ marginLeft: "auto", fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
          Total registered in this list: {filteredUsers.length}
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="loading-wrap">Loading account records...</div>
      ) : (
        <div className="mod-table-wrap">
          <table className="mod-table">
            <thead>
              <tr>
                <th>Profile Name</th>
                <th>Email Address</th>
                <th>Karma / Reputation</th>
                <th>Live Activity Status</th>
                <th style={{ textAlign: "right" }}>Management Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="mod-no-data">
                    No accounts registered under this role category.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const status = getUserStatus(u);
                  const isSelf = currentUser && (currentUser.id === u._id || currentUser._id === u._id);

                  return (
                    <tr key={u._id}>
                      <td>
                        <strong style={{ color: "var(--text-primary)" }}>{u.name}</strong>
                        {isSelf && <span style={{ fontSize: "0.7rem", color: "var(--accent-primary)", marginLeft: "6px" }}>(You)</span>}
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Role: {u.role.toUpperCase()}</div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                          {u.reputation || 0} pts
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: status.includes("present") || status.includes("Working")
                              ? "var(--accent-warning)"
                              : status.includes("resolved") || status.includes("Completed")
                                ? "var(--accent-success)"
                                : "var(--text-secondary)",
                            fontWeight: status.includes("No reports") || status.includes("Idle") ? 400 : 500,
                            fontStyle: status.includes("No reports") || status.includes("Idle") ? "italic" : "normal"
                          }}
                        >
                          ● {status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Edit user details"
                            onClick={() => openEditModal(u)}
                            style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Delete user account"
                            disabled={isSelf}
                            onClick={() => setDeletingUser(u)}
                            style={{
                              padding: "6px 10px",
                              fontSize: "0.8rem",
                              color: isSelf ? "var(--text-muted)" : "var(--accent-danger)",
                              borderColor: isSelf ? "var(--border-subtle)" : "rgba(239,68,68,0.3)"
                            }}
                          >
                            🗑️ Delete
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ 
                                fontSize: "0.8rem", 
                                padding: "6px 12px", 
                                background: "linear-gradient(135deg, var(--accent-primary), #4f46e5)", 
                                border: "none",
                                boxShadow: "0 2px 4px rgba(99,102,241,0.2)"
                              }}
                              onClick={() => startSimulation(u)}
                            >
                              💻 Simulate View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20000,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "14px",
              padding: "28px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>✏️ Edit User Account</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Role Access Level
                </label>
                <select
                  className="form-input"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  required
                >
                  <option value="citizen">Citizen</option>
                  <option value="staff">Staff / Field Inspector</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                  Karma / Reputation Points
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={editForm.reputation}
                  onChange={(e) => setEditForm({ ...editForm, reputation: e.target.value })}
                  min="0"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditingUser(null)}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={editLoading}
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20000,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--accent-danger)",
              borderRadius: "14px",
              padding: "28px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(239, 68, 68, 0.2)"
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.2rem", color: "var(--accent-danger)", fontWeight: 700 }}>
              🗑️ Delete User Account?
            </h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "20px" }}>
              Are you sure you want to permanently delete account <strong>"{deletingUser.name}"</strong> (<code>{deletingUser.email}</code>)?
              This action will remove their access permanently.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDeletingUser(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={confirmDeleteUser}
                disabled={deleteLoading}
                style={{ background: "var(--accent-danger)", border: "none" }}
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
