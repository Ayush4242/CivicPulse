import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const getCategoryLabel = (category) => {
  const labels = {
    pothole: "Pothole",
    streetlight: "Broken Streetlight",
    garbage: "Garbage Pileup",
    water_leakage: "Water Leakage",
    fallen_tree: "Fallen Tree",
    open_manhole: "Open Manhole",
    illegal_dumping: "Illegal Dumping",
    other: "Municipal Issue",
  };
  return labels[category] || category;
};

const isVerifiedReport = (staffStatus) =>
  staffStatus === "verified" || staffStatus === "completed";

function ModeratorDashboard() {
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({
    totalActive: 0,
    reported: 0,
    verified: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    rejected: 0,
    resolvedTotal: 0,
    pendingReview: 0,
  });
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedIncident, setSelectedIncident] = useState(null);
  const [targetStatus, setTargetStatus] = useState("");
  const [assignPhase, setAssignPhase] = useState("inspection");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [timelineMessage, setTimelineMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!currentUser || !["moderator", "admin"].includes(currentUser.role)) {
      navigate("/");
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const [incRes, statsRes] = await Promise.all([
          api.get("/api/incidents"),
          api.get("/api/incidents/moderation/stats"),
        ]);

        setIncidents(incRes.data.incidents || []);
        setStats(statsRes.data.stats || {});
      } catch (err) {
        console.error("Error loading dashboard data:", err);
        setError(err.response?.data?.message || "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const fetchAssignable = async () => {
    try {
      const res = await api.get("/api/auth/assignable-users");
      setAssignableUsers(res.data.users || []);
    } catch (err) {
      console.error("Error loading assignable users:", err);
      setError("Failed to load assignable staff.");
    }
  };

  const lastFieldNote = (incident) => {
    const entries = incident.internalTimeline || [];
    const last = [...entries]
      .reverse()
      .find((e) =>
        ["verified", "attention_needed", "false_report", "completed"].includes(e.status)
      );
    return last?.message || "";
  };

  const handleActionClick = (incident, status, phase = null) => {
    setSelectedIncident(incident);
    setTargetStatus(status);
    setSelectedAssignee("");
    setAssignPhase(phase || "inspection");

    let defaultMsg = "";
    if (status === "assigned" && phase === "inspection") {
      defaultMsg = "Inspection team assigned for on-site field check.";
      fetchAssignable();
    } else if (status === "assigned" && phase === "work") {
      defaultMsg = "Field person assigned to complete the work task.";
      fetchAssignable();
    } else if (status === "resolved") {
      defaultMsg = "Work verified by moderator — issue marked resolved.";
    } else if (status === "rejected") {
      defaultMsg =
        incident.staffStatus === "false_report"
          ? "Rejected based on field finding (false / invalid report)."
          : "Incident report rejected (invalid or duplicate).";
    }

    setTimelineMessage(defaultMsg);
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIncident || !targetStatus) return;

    try {
      setSubmitting(true);
      setError("");

      let response;
      if (targetStatus === "assigned") {
        if (!selectedAssignee) {
          setError("Please select a staff member to assign.");
          setSubmitting(false);
          return;
        }
        response = await api.patch(`/api/incidents/${selectedIncident._id}/assign`, {
          assignedTo: selectedAssignee,
          phase: assignPhase,
        });
      } else {
        response = await api.put(`/api/incidents/${selectedIncident._id}/status`, {
          status: targetStatus,
          message: timelineMessage,
        });
      }

      setIncidents((prev) =>
        prev.map((inc) => (inc._id === selectedIncident._id ? response.data.incident : inc))
      );

      const statsRes = await api.get("/api/incidents/moderation/stats");
      setStats(statsRes.data.stats || {});

      setSelectedIncident(null);
      setTargetStatus("");
      setTimelineMessage("");
      setSelectedAssignee("");
    } catch (err) {
      console.error("Error performing moderator action:", err);
      setError(err.response?.data?.message || "Failed to update incident.");
    } finally {
      setSubmitting(false);
    }
  };

  const getAvailableActions = (incident) => {
    const phase = incident.assignmentPhase;
    const staffOk = isVerifiedReport(incident.staffStatus);

    // STEP 1 — new report: assign an inspection team
    if (incident.status === "reported") {
      return [
        {
          label: "Assign Inspection Team",
          status: "assigned",
          phase: "inspection",
          btnClass: "btn-primary",
        },
        { label: "Reject Report", status: "rejected", btnClass: "btn-secondary" },
      ];
    }

    // STEP 2 — inspection confirmed: assign a field person to do the work
    if (incident.status === "verified") {
      return [
        {
          label: "Assign Field Person to Task",
          status: "assigned",
          phase: "work",
          btnClass: "btn-primary",
        },
        { label: "Reject Report", status: "rejected", btnClass: "btn-secondary" },
      ];
    }

    // During inspection
    if (incident.status === "in_progress" && phase === "inspection") {
      if (staffOk) {
        return [
          { label: "Mark Verified", status: "verified", btnClass: "btn-primary" },
          { label: "Reject Report", status: "rejected", btnClass: "btn-secondary" },
        ];
      }
      if (incident.staffStatus === "attention_needed") {
        return [
          {
            label: "Reassign Inspection Team",
            status: "assigned",
            phase: "inspection",
            btnClass: "btn-primary",
          },
        ];
      }
      if (incident.staffStatus === "false_report") {
        return [{ label: "Reject Report", status: "rejected", btnClass: "btn-secondary" }];
      }
      return [];
    }

    // STEP 3 — work finished: moderator resolves
    if (incident.status === "in_progress" && phase === "work") {
      if (staffOk) {
        return [{ label: "Mark as Resolved", status: "resolved", btnClass: "btn-primary" }];
      }
      if (incident.staffStatus === "attention_needed") {
        return [
          {
            label: "Reassign Field Person",
            status: "assigned",
            phase: "work",
            btnClass: "btn-primary",
          },
        ];
      }
      if (incident.staffStatus === "false_report") {
        return [{ label: "Reject Report", status: "rejected", btnClass: "btn-secondary" }];
      }
      return [];
    }

    return [];
  };

  /** Always tell the moderator what happens next */
  const getNextStep = (incident) => {
    const name = incident.assignedTo?.name;
    const phase = incident.assignmentPhase;
    const report = incident.lastFieldReport;

    if (incident.status === "reported") {
      return { text: "Next: Assign an inspection team", tone: "action" };
    }
    if (incident.status === "assigned" && phase === "inspection") {
      return {
        text: name
          ? `Inspection assigned to ${name} — waiting for their report on Tasks`
          : "Inspection assigned — waiting for field report on Tasks",
        tone: "wait",
      };
    }
    if (incident.status === "in_progress" && phase === "inspection" && incident.staffStatus === "started") {
      return {
        text: name
          ? `${name} is inspecting — waiting for report on Tasks`
          : "Inspection in progress — waiting for report on Tasks",
        tone: "wait",
      };
    }
    if (incident.status === "in_progress" && phase === "inspection" && isVerifiedReport(incident.staffStatus)) {
      const by = report?.reportedBy?.name;
      return {
        text: by
          ? `Inspection reported verified by ${by} — next: Mark Verified`
          : "Inspection reported verified — next: Mark Verified",
        tone: "action",
      };
    }
    if (incident.status === "verified") {
      return {
        text: "Inspection verified — next: Assign field worker to repair",
        tone: "action",
      };
    }
    if (incident.status === "assigned" && phase === "work") {
      return {
        text: name
          ? `Task assigned to ${name} — waiting for them to finish & report on Tasks`
          : "Work task assigned — waiting for field report on Tasks",
        tone: "wait",
      };
    }
    if (incident.status === "in_progress" && phase === "work" && incident.staffStatus === "started") {
      return {
        text: name
          ? `${name} is working — waiting for completion report on Tasks`
          : "Work in progress — waiting for report on Tasks",
        tone: "wait",
      };
    }
    if (
      incident.status === "in_progress" &&
      phase === "work" &&
      isVerifiedReport(incident.staffStatus)
    ) {
      const by = report?.reportedBy?.name;
      return {
        text: by
          ? `${by} reported work finished — next: Mark as Resolved`
          : "Work finished — next: Mark as Resolved",
        tone: "action",
      };
    }
    if (incident.staffStatus === "attention_needed") {
      return { text: "Field flagged attention needed — reassign or follow up", tone: "action" };
    }
    if (incident.staffStatus === "false_report") {
      return { text: "Field marked false report — Reject if you agree", tone: "action" };
    }
    if (incident.status === "resolved") {
      return { text: "Resolved — waiting for citizen to confirm", tone: "wait" };
    }
    if (incident.status === "closed") {
      return { text: "Closed by citizen", tone: "done" };
    }
    if (incident.status === "rejected") {
      return { text: "Rejected", tone: "done" };
    }
    return { text: "—", tone: "wait" };
  };

  const filteredIncidents = incidents.filter((inc) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending_review"
        ? (inc.status === "verified" &&
            inc.assignmentPhase === "inspection" &&
            isVerifiedReport(inc.staffStatus)) ||
          (["assigned", "in_progress"].includes(inc.status) &&
            ["attention_needed", "false_report"].includes(inc.staffStatus)) ||
          (inc.status === "in_progress" &&
            inc.assignmentPhase === "work" &&
            isVerifiedReport(inc.staffStatus))
        : inc.status === statusFilter);
    const matchesCategory = categoryFilter === "all" || inc.category === categoryFilter;
    const matchesSeverity = severityFilter === "all" || inc.severity === severityFilter;

    const matchesSearch =
      searchQuery.trim() === "" ||
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.location?.address &&
        inc.location.address.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesCategory && matchesSeverity && matchesSearch;
  });

  const activeFieldTasks = incidents.filter(
    (inc) =>
      inc.assignedTo &&
      ["assigned", "in_progress"].includes(inc.status) &&
      inc.status !== "resolved" &&
      inc.status !== "closed" &&
      inc.status !== "rejected"
  );

  if (loading) {
    return <div className="loading-wrap">Loading moderator control panel...</div>;
  }

  return (
    <div className="mod-dashboard">
      <div className="mod-dashboard-header">
        <h1>Moderator Control Panel</h1>
        <p>
          Complete workflow: <strong>1) Assign Inspection Team</strong> → they report on Tasks →{" "}
          <strong>2) Assign Field Person to Task</strong> → they finish &amp; report on Tasks →{" "}
          <strong>3) Mark as Resolved</strong> → citizen confirms.
        </p>
        <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
          Field people update progress under <strong>Tasks</strong> in the navbar. You decide the next
          step here (or on Tasks → Reports Back).
        </p>
      </div>

      {error && <div className="error-wrap">{error}</div>}

      <div className="mod-stats-grid">
        <div className="mod-stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-count">{stats.totalActive}</div>
          <div className="stat-label">Active Reports</div>
        </div>
        <div className="mod-stat-card">
          <div className="stat-icon">📥</div>
          <div className="stat-count">{stats.reported}</div>
          <div className="stat-label">Reported</div>
        </div>
        <div className="mod-stat-card">
          <div className="stat-icon">🔍</div>
          <div className="stat-count">{stats.verified}</div>
          <div className="stat-label">Inspection OK</div>
        </div>
        <div className="mod-stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-count">{stats.pendingReview || 0}</div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="mod-stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-count">{stats.resolvedTotal ?? stats.resolved}</div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="mod-stat-card">
          <div className="stat-icon">🔒</div>
          <div className="stat-count">{stats.closed}</div>
          <div className="stat-label">Closed</div>
        </div>
      </div>

      {/* Active Field Tasks Grid */}
      <div className="detail-block" style={{ marginBottom: "32px", padding: "24px" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
          <span>📋</span> Active Field Tasks
        </h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
          Track and manage active field verification or work crew tasks. Review field findings and update statuses below.
        </p>
        {activeFieldTasks.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic", padding: "12px 0" }}>
            No active tasks currently assigned to field staff. Use the queue table below to assign inspectors or workers.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {activeFieldTasks.map((task) => {
              const actions = getAvailableActions(task);
              const next = getNextStep(task);
              const fieldNote = task.lastFieldReport?.message || lastFieldNote(task);
              const reportBy = task.lastFieldReport?.reportedBy?.name;
              
              return (
                <div key={task._id} className="mod-stat-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px", background: "rgba(255, 255, 255, 0.02)", cursor: "default" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                      <span style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: task.assignmentPhase === "inspection" ? "var(--accent-primary)" : "var(--accent-success)",
                        background: task.assignmentPhase === "inspection" ? "rgba(99, 102, 241, 0.1)" : "rgba(34, 197, 94, 0.1)",
                        padding: "2px 6px",
                        borderRadius: "4px"
                      }}>
                        {task.assignmentPhase}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className={`status-dot status-${task.status}`} style={{ width: "8px", height: "8px" }} />
                        <span style={{ fontSize: "0.75rem", textTransform: "capitalize", color: "var(--text-muted)" }}>
                          {task.status?.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <h3 
                      onClick={() => navigate(`/incidents/${task._id}`)}
                      style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", textDecoration: "none", marginBottom: "6px" }}
                      onMouseEnter={(e) => e.target.style.textDecoration = "underline"}
                      onMouseLeave={(e) => e.target.style.textDecoration = "none"}
                    >
                      {task.title}
                    </h3>
                    
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Assigned: <strong>{task.assignedTo?.name || "Unassigned"}</strong>
                    </div>
                    
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "12px" }}>
                      Crew Status:{" "}
                      <span style={{ 
                        fontWeight: 700, 
                        color: task.staffStatus === "verified" || task.staffStatus === "completed" 
                          ? "var(--accent-success)" 
                          : task.staffStatus === "started" 
                            ? "var(--accent-warning)" 
                            : "var(--text-muted)"
                      }}>
                        {task.staffStatus === "verified" || task.staffStatus === "completed" 
                          ? "✅ Completed" 
                          : task.staffStatus === "started" 
                            ? "⏳ Work Started" 
                            : "💤 Awaiting Start"}
                      </span>
                    </div>

                    {fieldNote && (
                      <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "8px 10px", borderRadius: "6px", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "12px", fontStyle: "italic", lineHeight: 1.35 }}>
                        {reportBy ? <strong>{reportBy}: </strong> : ""}“{fieldNote}”
                        {task.lastFieldReport?.photo && (
                          <div style={{ marginTop: "6px" }}>
                            <a
                              href={task.lastFieldReport.photo}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--accent-primary)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "3px" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              📷 View Evidence Photo
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
                      <strong>Next action:</strong> {next.text}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {actions.map((act) => (
                        <button
                          key={`${act.status}-${act.phase || ""}`}
                          type="button"
                          className={`btn ${act.btnClass} btn-sm`}
                          style={{ flex: 1, fontSize: "0.75rem", padding: "6px" }}
                          onClick={() => handleActionClick(task, act.status, act.phase)}
                        >
                          {act.label}
                        </button>
                      ))}
                      {actions.length === 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1, fontSize: "0.75rem", padding: "6px" }}
                          onClick={() => navigate("/staff")}
                        >
                          Open Tasks Section
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mod-filters">
        <input
          type="text"
          className="form-input"
          placeholder="Search by title, desc or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flexGrow: 1 }}
        />

        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending_review">Needs Your Decision</option>
          <option value="reported">Reported</option>
          <option value="verified">Inspection Confirmed</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          className="form-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="pothole">Potholes</option>
          <option value="streetlight">Streetlights</option>
          <option value="garbage">Garbage Pileups</option>
          <option value="water_leakage">Water Leakage</option>
          <option value="fallen_tree">Fallen Trees</option>
          <option value="open_manhole">Open Manholes</option>
          <option value="illegal_dumping">Illegal Dumping</option>
          <option value="other">Other Issues</option>
        </select>

        <select
          className="form-select"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="all">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className="mod-table-wrap">
        <table className="mod-table">
          <thead>
            <tr>
              <th>Title & Category</th>
              <th>Reporter</th>
              <th>Severity</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Next Step</th>
              <th style={{ textAlign: "right" }}>Your Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={8} className="mod-no-data">
                  No matching incidents found.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((incident) => {
                const actions = getAvailableActions(incident);
                const next = getNextStep(incident);
                const fieldNote =
                  incident.lastFieldReport?.message || lastFieldNote(incident);
                const reportBy = incident.lastFieldReport?.reportedBy?.name;
                return (
                  <tr key={incident._id}>
                    <td>
                      <div
                        className="mod-incident-title"
                        onClick={() => navigate(`/incidents/${incident._id}`)}
                      >
                        {incident.title}
                      </div>
                      <div className="mod-incident-category">
                        {getCategoryLabel(incident.category)}
                      </div>
                      {fieldNote && (
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                            marginTop: "4px",
                            maxWidth: "220px",
                            lineHeight: 1.35,
                          }}
                          title={fieldNote}
                        >
                          {reportBy ? `${reportBy}: ` : ""}
                          {fieldNote.length > 80 ? `${fieldNote.slice(0, 80)}…` : fieldNote}
                          {incident.lastFieldReport?.photo && (
                            <div style={{ marginTop: "4px" }}>
                              <a
                                href={incident.lastFieldReport.photo}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--accent-primary)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                📷 View Evidence Photo
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {incident.reportedBy?.name || "Anonymous Citizen"}
                    </td>
                    <td>
                      <span className={`severity-badge ${incident.severity}`}>
                        {incident.severity}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      {incident.priorityScore}
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span className={`status-dot status-${incident.status}`} />
                        <span style={{ textTransform: "capitalize" }}>
                          {incident.status?.replace("_", " ")}
                        </span>
                      </div>
                      {incident.assignmentPhase && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            marginTop: 2,
                            textTransform: "capitalize",
                          }}
                        >
                          Phase: {incident.assignmentPhase}
                        </div>
                      )}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {incident.assignedTo?.name ? (
                        <>
                          <strong>{incident.assignedTo.name}</strong>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            {incident.assignmentPhase === "inspection"
                              ? "Inspection team"
                              : incident.assignmentPhase === "work"
                                ? "Field task"
                                : incident.assignedTo.role}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                          Nobody yet
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          lineHeight: 1.35,
                          display: "block",
                          maxWidth: 220,
                          color:
                            next.tone === "action"
                              ? "var(--accent-primary)"
                              : next.tone === "done"
                                ? "var(--accent-success)"
                                : "var(--text-secondary)",
                          fontWeight: next.tone === "action" ? 600 : 400,
                        }}
                      >
                        {next.text}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {actions.map((act) => (
                          <button
                            key={`${act.status}-${act.phase || ""}-${act.label}`}
                            type="button"
                            className={`btn ${act.btnClass} btn-sm`}
                            onClick={() => handleActionClick(incident, act.status, act.phase)}
                          >
                            {act.label}
                          </button>
                        ))}
                        {actions.length === 0 && next.tone === "wait" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate("/staff")}
                          >
                            Open Tasks
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

      {selectedIncident && (
        <div className="mod-action-panel" onClick={() => setSelectedIncident(null)}>
          <div className="mod-action-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {targetStatus === "assigned"
                ? assignPhase === "inspection"
                  ? "Assign Inspection Team"
                  : "Assign Field Person to Task"
                : targetStatus === "resolved"
                  ? "Mark as Resolved"
                  : "Update Incident"}
            </h3>
            <p className="action-subtitle">
              Report: <strong>{selectedIncident.title}</strong>
            </p>
            {targetStatus === "assigned" && assignPhase === "inspection" && (
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                Pick who will go to the site, inspect, and report back on <strong>Tasks</strong>.
              </p>
            )}
            {targetStatus === "assigned" && assignPhase === "work" && (
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                Inspection is done. Pick the field person who will do the work and report completion on{" "}
                <strong>Tasks</strong>.
              </p>
            )}
            {(selectedIncident.lastFieldReport?.message || lastFieldNote(selectedIncident)) && (
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  background: "rgba(0,0,0,0.04)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  marginBottom: "14px",
                  lineHeight: 1.4,
                }}
              >
                <strong>
                  Field report
                  {selectedIncident.lastFieldReport?.reportedBy?.name
                    ? ` from ${selectedIncident.lastFieldReport.reportedBy.name}`
                    : ""}
                  :
                </strong>{" "}
                {selectedIncident.lastFieldReport?.message || lastFieldNote(selectedIncident)}
                {selectedIncident.lastFieldReport?.photo && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={selectedIncident.lastFieldReport.photo}
                      alt="Completion evidence"
                      style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, objectFit: "contain", border: "1px solid var(--border-color)" }}
                    />
                  </div>
                )}
              </div>
            )}
            <form onSubmit={handleStatusSubmit}>
              {targetStatus === "assigned" && (
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label">
                    {assignPhase === "inspection"
                      ? "Who is on the inspection team?"
                      : "Who is assigned this field task?"}
                  </label>
                  <select
                    className="form-select"
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    required
                  >
                    <option value="">Select a person...</option>
                    {assignableUsers.length === 0 ? (
                      <option value="" disabled>
                        No staff/moderators found — create a staff account first
                      </option>
                    ) : (
                      assignableUsers.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.name} ({user.role})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Public timeline note</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Shown on the incident timeline..."
                  value={timelineMessage}
                  onChange={(e) => setTimelineMessage(e.target.value)}
                />
              </div>

              <div className="action-buttons">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting || (targetStatus === "assigned" && assignableUsers.length === 0)}
                >
                  {submitting
                    ? "Saving..."
                    : targetStatus === "assigned"
                      ? assignPhase === "inspection"
                        ? "Confirm — Assign Inspection"
                        : "Confirm — Assign Field Task"
                      : targetStatus === "resolved"
                        ? "Confirm — Mark Resolved"
                        : "Confirm"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedIncident(null);
                    setTargetStatus("");
                    setTimelineMessage("");
                    setSelectedAssignee("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModeratorDashboard;
