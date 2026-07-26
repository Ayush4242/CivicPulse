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

const REPORTED_BACK = ["verified", "attention_needed", "false_report", "completed"];

const isVerifiedReport = (s) => s === "verified" || s === "completed";

const OUTCOME_META = {
  inspection: {
    started: {
      title: "Start Field Inspection",
      label: "Notes (optional)",
      placeholder: "Arrived on site / initial observations...",
      confirm: "Start Inspection",
    },
    verified: {
      title: "Report Back: Issue Confirmed",
      label: "Inspection findings",
      placeholder: "Confirm the issue exists and note details for the moderator...",
      confirm: "Send Report to Moderator",
    },
    attention_needed: {
      title: "Report Back: Attention Needed",
      label: "What needs attention?",
      placeholder: "Access blocked, unclear location, needs specialist...",
      confirm: "Send Report to Moderator",
    },
    false_report: {
      title: "Report Back: False / Invalid",
      label: "Why is this invalid?",
      placeholder: "Not found, already fixed, wrong location, duplicate...",
      confirm: "Send Report to Moderator",
    },
  },
  work: {
    started: {
      title: "Start Work Task",
      label: "Notes (optional)",
      placeholder: "Dispatch / site conditions...",
      confirm: "Start Work",
    },
    verified: {
      title: "Report Back: Work Finished",
      label: "What was completed?",
      placeholder: "Describe the repair so the moderator can resolve the incident...",
      confirm: "Send Report to Moderator",
    },
    attention_needed: {
      title: "Report Back: Attention Needed",
      label: "What needs attention?",
      placeholder: "Parts needed, hazards, blockers...",
      confirm: "Send Report to Moderator",
    },
    false_report: {
      title: "Report Back: False / Invalid",
      label: "Why?",
      placeholder: "Explain why this should be rejected...",
      confirm: "Send Report to Moderator",
    },
  },
};

function StaffDashboard() {
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedIncident, setSelectedIncident] = useState(null);
  const [reportStatus, setReportStatus] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [reportPhoto, setReportPhoto] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Moderator follow-up actions from Tasks
  const [modAction, setModAction] = useState(null); // { incident, status, phase }
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [timelineMessage, setTimelineMessage] = useState("");

  const [filterType, setFilterType] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user"));
      return u && ["moderator", "admin"].includes(u.role) ? "reported" : "mine";
    } catch {
      return "mine";
    }
  });

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  })();

  const isModerator = currentUser && ["moderator", "admin"].includes(currentUser.role);

  const isAssignedToMe = (inc) =>
    inc.assignedTo?._id === currentUser?.id ||
    inc.assignedTo?.id === currentUser?.id ||
    inc.assignedTo === currentUser?.id;

  const isTaskIncident = (inc) =>
    Boolean(inc.assignmentPhase) &&
    ["assigned", "in_progress", "verified"].includes(inc.status) &&
    inc.status !== "closed" &&
    inc.status !== "rejected";

  const needsModDecision = (inc) => {
    if (inc.status === "verified" && inc.assignmentPhase === "inspection" && isVerifiedReport(inc.staffStatus)) {
      return true;
    }
    if (["attention_needed", "false_report"].includes(inc.staffStatus)) return true;
    if (
      inc.status === "in_progress" &&
      inc.assignmentPhase === "work" &&
      isVerifiedReport(inc.staffStatus)
    ) {
      return true;
    }
    return false;
  };

  const loadIncidents = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/incidents");
      setIncidents(res.data.incidents || []);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError(err.response?.data?.message || "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || !["staff", "moderator", "admin"].includes(currentUser.role)) {
      navigate("/");
      return;
    }
    loadIncidents();
  }, [navigate]);

  const handleReportClick = (incident, status) => {
    setSelectedIncident(incident);
    setReportStatus(status);
    setReportNote("");
    setReportPhoto(null);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedIncident || !reportStatus) return;

    const isInspection = selectedIncident.assignmentPhase === "inspection";
    const isWorkCompletion = !isInspection && reportStatus === "verified";

    if (isWorkCompletion && !reportPhoto) {
      setError("Please upload a completion photo as evidence.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      let photoUrl = null;
      if (reportPhoto) {
        setPhotoUploading(true);
        const formData = new FormData();
        formData.append("images", reportPhoto);
        const uploadRes = await api.post("/api/upload/images", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        photoUrl = uploadRes.data.images?.[0];
        setPhotoUploading(false);
      }

      const res = await api.post(`/api/incidents/${selectedIncident._id}/staff-report`, {
        status: reportStatus,
        message: reportNote,
        photo: photoUrl,
      });

      setIncidents((prev) =>
        prev.map((inc) => (inc._id === selectedIncident._id ? res.data.incident : inc))
      );
      setSelectedIncident(null);
      setReportStatus("");
      setReportNote("");
      setReportPhoto(null);
    } catch (err) {
      console.error("Error submitting report:", err);
      setError(err.response?.data?.message || "Failed to submit field report.");
      setPhotoUploading(false);
    } finally {
      setSubmitting(false);
    }
  };

  const openModAction = async (incident, status, phase = null) => {
    setModAction({ incident, status, phase });
    setSelectedAssignee("");
    let msg = "";
    if (status === "assigned" && phase === "work") {
      msg = "Inspection confirmed — assigning work task.";
    } else if (status === "assigned" && phase === "inspection") {
      msg = "Reassigning field inspection.";
    } else if (status === "resolved") {
      msg = "Work report reviewed — marking resolved.";
    } else if (status === "rejected") {
      msg = "Rejected based on field report.";
    }
    setTimelineMessage(msg);

    if (status === "assigned") {
      try {
        const res = await api.get("/api/auth/assignable-users");
        setAssignableUsers(res.data.users || []);
      } catch (err) {
        setError("Failed to load assignable staff.");
      }
    }
  };

  const handleModSubmit = async (e) => {
    e.preventDefault();
    if (!modAction) return;

    try {
      setSubmitting(true);
      setError("");

      let response;
      if (modAction.status === "assigned") {
        if (!selectedAssignee) {
          setError("Please select who to assign.");
          setSubmitting(false);
          return;
        }
        response = await api.patch(`/api/incidents/${modAction.incident._id}/assign`, {
          assignedTo: selectedAssignee,
          phase: modAction.phase,
        });
      } else {
        response = await api.put(`/api/incidents/${modAction.incident._id}/status`, {
          status: modAction.status,
          message: timelineMessage,
        });
      }

      setIncidents((prev) =>
        prev.map((inc) => (inc._id === modAction.incident._id ? response.data.incident : inc))
      );
      setModAction(null);
    } catch (err) {
      console.error("Moderator action error:", err);
      setError(err.response?.data?.message || "Failed to update task.");
    } finally {
      setSubmitting(false);
    }
  };

  const getModActions = (incident) => {
    if (!isModerator) return [];
    const phase = incident.assignmentPhase;
    const actions = [];

    if (
      incident.status === "verified" &&
      phase === "inspection" &&
      isVerifiedReport(incident.staffStatus)
    ) {
      actions.push({ label: "Assign Field Person to Task", status: "assigned", phase: "work", btnClass: "btn-primary" });
      actions.push({ label: "Reject Report", status: "rejected", btnClass: "btn-secondary" });
    } else if (phase === "inspection" && incident.staffStatus === "attention_needed") {
      actions.push({
        label: "Reassign Inspection Team",
        status: "assigned",
        phase: "inspection",
        btnClass: "btn-primary",
      });
    } else if (incident.staffStatus === "false_report") {
      actions.push({ label: "Reject Report", status: "rejected", btnClass: "btn-secondary" });
    } else if (
      phase === "work" &&
      incident.status === "in_progress" &&
      isVerifiedReport(incident.staffStatus)
    ) {
      actions.push({ label: "Mark as Resolved", status: "resolved", btnClass: "btn-primary" });
    } else if (phase === "work" && incident.staffStatus === "attention_needed") {
      actions.push({
        label: "Reassign Field Person",
        status: "assigned",
        phase: "work",
        btnClass: "btn-primary",
      });
    }

    return actions;
  };

  const taskPool = incidents.filter((inc) => {
    if (!isTaskIncident(inc)) return false;
    // Staff only see their own assigned tasks
    if (currentUser?.role === "staff") return isAssignedToMe(inc);
    return true;
  });

  const filteredTasks = taskPool.filter((task) => {
    if (filterType === "mine") return isAssignedToMe(task);
    if (filterType === "reported") return needsModDecision(task) || REPORTED_BACK.includes(task.staffStatus);
    // active: waiting on field person OR in progress without final report
    if (filterType === "active") {
      return (
        (task.staffStatus === "idle" || task.staffStatus === "started") &&
        ["assigned", "in_progress"].includes(task.status)
      );
    }
    return true;
  });

  const activeCount = taskPool.filter(
    (t) =>
      (t.staffStatus === "idle" || t.staffStatus === "started") &&
      ["assigned", "in_progress"].includes(t.status)
  ).length;
  const reportedCount = taskPool.filter(
    (t) => needsModDecision(t) || REPORTED_BACK.includes(t.staffStatus)
  ).length;
  const mineCount = taskPool.filter(isAssignedToMe).length;

  const renderReportBlock = (task) => {
    const report = task.lastFieldReport;
    if (!report?.outcome) {
      return (
        <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.85rem" }}>
          No report yet — awaiting field update
        </span>
      );
    }

    const outcomeColors = {
      started: "var(--accent-warning)",
      verified: "var(--accent-success)",
      completed: "var(--accent-success)",
      attention_needed: "var(--accent-warning)",
      false_report: "var(--accent-danger)",
    };

    const outcomeLabel = {
      started: "Started",
      verified: report.phase === "inspection" ? "Verified (issue real)" : "Work finished",
      completed: "Work finished",
      attention_needed: "Attention needed",
      false_report: "False / invalid",
    };

    return (
      <div style={{ fontSize: "0.82rem", lineHeight: 1.45, maxWidth: 280 }}>
        <div style={{ fontWeight: 700, color: outcomeColors[report.outcome] || "inherit" }}>
          {outcomeLabel[report.outcome] || report.outcome}
        </div>
        <div style={{ color: "var(--text-secondary)" }}>
          By <strong>{report.reportedBy?.name || "Field staff"}</strong>
          {report.reportedAt && (
            <span style={{ color: "var(--text-muted)" }}>
              {" "}
              · {new Date(report.reportedAt).toLocaleString()}
            </span>
          )}
        </div>
        {report.message && (
          <div
            style={{ color: "var(--text-muted)", marginTop: 4 }}
            title={report.message}
          >
            “{report.message.length > 90 ? `${report.message.slice(0, 90)}…` : report.message}”
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="loading-wrap">Loading tasks...</div>;
  }

  const phaseKey = selectedIncident?.assignmentPhase === "inspection" ? "inspection" : "work";
  const meta = OUTCOME_META[phaseKey]?.[reportStatus];

  return (
    <div className="mod-dashboard">
      <div className="mod-dashboard-header">
        <h1>Tasks</h1>
        <p>
          Field inspection and work assignments live here. Assignees report back on this page; moderators
          review those reports, then assign work or mark the incident resolved.
        </p>
      </div>

      {error && <div className="error-wrap">{error}</div>}

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        {isModerator && (
          <>
            <button
              className={`btn ${filterType === "active" ? "btn-primary" : "btn-secondary"} btn-sm`}
              onClick={() => setFilterType("active")}
            >
              In Field ({activeCount})
            </button>
            <button
              className={`btn ${filterType === "reported" ? "btn-primary" : "btn-secondary"} btn-sm`}
              onClick={() => setFilterType("reported")}
            >
              Reports Back ({reportedCount})
            </button>
          </>
        )}
        <button
          className={`btn ${filterType === "mine" ? "btn-primary" : "btn-secondary"} btn-sm`}
          onClick={() => setFilterType("mine")}
        >
          Assigned to Me ({mineCount})
        </button>
      </div>

      <div className="mod-table-wrap">
        <table className="mod-table">
          <thead>
            <tr>
              <th>Incident</th>
              <th>Phase</th>
              <th>Assigned To</th>
              <th>Field Report (who / what)</th>
              <th>Public Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="mod-no-data">
                  No tasks in this view. When a moderator sends someone for inspection or work, it
                  appears here.
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => {
                const isInspection = task.assignmentPhase === "inspection";
                const mine = isAssignedToMe(task);
                const modActions = getModActions(task);
                const canActInField =
                  mine &&
                  ["assigned", "in_progress"].includes(task.status) &&
                  (task.staffStatus === "idle" || task.staffStatus === "started");

                return (
                  <tr key={task._id}>
                    <td>
                      <div
                        className="mod-incident-title"
                        onClick={() => navigate(`/incidents/${task._id}`)}
                      >
                        {task.title}
                      </div>
                      <div className="mod-incident-category">
                        {getCategoryLabel(task.category)} · {task.location?.address || "No address"}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: isInspection ? "var(--accent-primary)" : "var(--accent-success)",
                        }}
                      >
                        {task.assignmentPhase || "—"}
                      </span>
                    </td>
                    <td>
                      {task.assignedTo?.name ? (
                        <>
                          <strong>{task.assignedTo.name}</strong>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            {task.assignedTo.role}
                            {mine ? " · you" : ""}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>{renderReportBlock(task)}</td>
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span className={`status-dot status-${task.status}`} />
                        <span style={{ textTransform: "capitalize", fontSize: "0.85rem" }}>
                          {task.status?.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        {canActInField && task.staffStatus === "idle" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleReportClick(task, "started")}
                            >
                              {isInspection ? "Start Inspection" : "Start Work"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleReportClick(task, "false_report")}
                            >
                              False Report
                            </button>
                          </>
                        )}
                        {canActInField && task.staffStatus === "started" && (
                          <>
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => handleReportClick(task, "verified")}
                            >
                              {isInspection ? "Confirm & Report Back" : "Finish & Report Back"}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleReportClick(task, "attention_needed")}
                            >
                              Attention Needed
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleReportClick(task, "false_report")}
                              style={{ color: "var(--accent-danger)" }}
                            >
                              False Report
                            </button>
                          </>
                        )}

                        {modActions.map((act) => (
                          <button
                            key={act.label}
                            type="button"
                            className={`btn ${act.btnClass} btn-sm`}
                            onClick={() => openModAction(task, act.status, act.phase)}
                          >
                            {act.label}
                          </button>
                        ))}

                        {!canActInField &&
                          modActions.length === 0 &&
                          REPORTED_BACK.includes(task.staffStatus) && (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {isModerator ? "Review report above" : "Reported — awaiting moderator"}
                            </span>
                          )}

                        {!canActInField &&
                          modActions.length === 0 &&
                          !REPORTED_BACK.includes(task.staffStatus) &&
                          !mine && (
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              Awaiting assignee
                            </span>
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

      {/* Field report modal (assignee) */}
      {selectedIncident && meta && (
        <div className="mod-action-panel" onClick={() => setSelectedIncident(null)}>
          <div className="mod-action-card" onClick={(e) => e.stopPropagation()}>
            <h3>{meta.title}</h3>
            <p className="action-subtitle">
              This update goes to the moderator on <strong>Tasks</strong>.
              <br />
              Incident: <strong>{selectedIncident.title}</strong>
            </p>
            <form onSubmit={handleReportSubmit}>
              <div className="form-group">
                <label className="form-label">{meta.label}</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder={meta.placeholder}
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  required={reportStatus !== "started"}
                />
              </div>
              {/* Photo upload input for work completion */}
              {selectedIncident.assignmentPhase !== "inspection" && reportStatus === "verified" && (
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    📷 Completion Photo <span style={{ color: "var(--accent-danger)", fontSize: "0.8rem" }}>(required)</span>
                  </label>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 8px 0" }}>
                    Upload a photo of the completed work as evidence.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReportPhoto(e.target.files[0] || null)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "0.85rem",
                    }}
                    required
                  />
                  {reportPhoto && (
                    <div style={{ marginTop: "8px", position: "relative", display: "inline-block" }}>
                      <img
                        src={URL.createObjectURL(reportPhoto)}
                        alt="Preview"
                        style={{ maxWidth: "200px", maxHeight: "150px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                      />
                      <button
                        type="button"
                        onClick={() => setReportPhoto(null)}
                        style={{
                          position: "absolute", top: "-6px", right: "-6px",
                          background: "var(--accent-danger)", color: "#fff",
                          border: "none", borderRadius: "50%", width: "22px", height: "22px",
                          fontSize: "0.75rem", cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}
                      >✕</button>
                    </div>
                  )}
                </div>
              )}
              <div className="action-buttons">
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || photoUploading}>
                  {photoUploading ? "Uploading photo..." : submitting ? "Sending..." : meta.confirm}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedIncident(null);
                    setReportStatus("");
                    setReportNote("");
                    setReportPhoto(null);
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

      {/* Moderator decision modal */}
      {modAction && (
        <div className="mod-action-panel" onClick={() => setModAction(null)}>
          <div className="mod-action-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {modAction.status === "assigned"
                ? modAction.phase === "work"
                  ? "Assign Field Person to Task"
                  : "Assign Inspection Team"
                : modAction.status === "resolved"
                  ? "Mark as Resolved"
                  : "Update Status"}
            </h3>
            <p className="action-subtitle">
              Incident: <strong>{modAction.incident.title}</strong>
            </p>
            {modAction.incident.lastFieldReport?.message && (
              <div
                style={{
                  fontSize: "0.85rem",
                  background: "rgba(0,0,0,0.04)",
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginBottom: 14,
                  lineHeight: 1.4,
                }}
              >
                <strong>
                  Report from {modAction.incident.lastFieldReport.reportedBy?.name || "field"}:
                </strong>{" "}
                {modAction.incident.lastFieldReport.message}
                {modAction.incident.lastFieldReport?.photo && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={modAction.incident.lastFieldReport.photo}
                      alt="Completion evidence"
                      style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, objectFit: "contain", border: "1px solid var(--border-color)" }}
                    />
                  </div>
                )}
              </div>
            )}
            <form onSubmit={handleModSubmit}>
              {modAction.status === "assigned" && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">
                    {modAction.phase === "work" ? "Assign work to" : "Assign inspector"}
                  </label>
                  <select
                    className="form-select"
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    required
                  >
                    <option value="">Choose staff / moderator...</option>
                    {assignableUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Timeline note</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={timelineMessage}
                  onChange={(e) => setTimelineMessage(e.target.value)}
                />
              </div>
              <div className="action-buttons">
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? "Updating..." : "Confirm"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModAction(null)}
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

export default StaffDashboard;
