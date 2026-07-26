import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import IncidentMap from "../components/IncidentMap";

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

const timeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

function IncidentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [upvoteLoading, setUpvoteLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const [error, setError] = useState("");

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [closeLoading, setCloseLoading] = useState(false);
  
  // Moderator states
  const [actionLoading, setActionLoading] = useState(false);
  const [showModAction, setShowModAction] = useState(false);
  const [modActionStatus, setModActionStatus] = useState("");
  const [modAssignPhase, setModAssignPhase] = useState("inspection");
  const [modActionNote, setModActionNote] = useState("");
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");

  // Staff action states
  const [submittingStaffReport, setSubmittingStaffReport] = useState(false);
  const [showStaffAction, setShowStaffAction] = useState(false);
  const [staffActionStatus, setStaffActionStatus] = useState("");
  const [staffActionNote, setStaffActionNote] = useState("");
  const [staffActionPhoto, setStaffActionPhoto] = useState(null);
  const [staffPhotoUploading, setStaffPhotoUploading] = useState(false);
  
  // Lightbox modal state
  const [activePhoto, setActivePhoto] = useState(null);

  const token = localStorage.getItem("token");
  let currentUser = null;

  try {
    currentUser = JSON.parse(localStorage.getItem("user"));
  } catch {
    currentUser = null;
  }

  useEffect(() => {
    const loadPage = async () => {
      try {
        setLoading(true);
        setError("");

        const [incidentResponse, commentsResponse] = await Promise.all([
          api.get(`/api/incidents/${id}`),
          api.get(`/api/incidents/${id}/comments`),
        ]);

        setIncident(incidentResponse.data.incident);
        setComments(commentsResponse.data.comments || []);
      } catch (error) {
        console.error("Error loading incident:", error);
        setError(error.response?.data?.message || "Unable to load incident.");
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [id]);

  const hasUpvoted =
    incident?.upvotes?.some((userId) => {
      const idValue = typeof userId === "object" ? userId._id : userId;
      return idValue?.toString() === currentUser?.id;
    }) || false;

  const isReporter = currentUser && (
    incident?.reportedBy?._id === currentUser.id ||
    incident?.reportedBy?.id === currentUser.id ||
    incident?.reportedBy === currentUser.id
  );

  const handleUpvote = async () => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setUpvoteLoading(true);
      setError("");

      const response = await api.post(`/api/incidents/${id}/upvote`);
      setIncident((previousIncident) => ({
        ...previousIncident,
        upvotes: response.data.upvotes,
        priorityScore: response.data.priorityScore,
      }));
    } catch (error) {
      console.error("Upvote error:", error);
      setError(error.response?.data?.message || "Unable to update upvote.");
    } finally {
      setUpvoteLoading(false);
    }
  };

  const isModerator = currentUser && ["moderator", "admin"].includes(currentUser.role);

  const handleModAction = async (targetStatus, phase = null) => {
    if (targetStatus === "assigned") {
      try {
        const res = await api.get("/api/auth/assignable-users");
        setAssignableUsers(res.data.users || []);
      } catch (err) {
        console.error("Error fetching assignable users:", err);
      }
    }
    setModActionStatus(targetStatus);
    setModAssignPhase(phase || "inspection");
    setShowModAction(true);
    setModActionNote("");
    setSelectedAssignee("");
  };

  const handleModActionSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError("");

      if (modActionStatus === "assigned") {
        if (!selectedAssignee) {
          setError("Please select a user to assign.");
          setActionLoading(false);
          return;
        }
        const response = await api.patch(`/api/incidents/${id}/assign`, {
          assignedTo: selectedAssignee,
          phase: modAssignPhase,
        });
        setIncident(response.data.incident);
      } else {
        const defaultMessages = {
          resolved: "Incident has been resolved.",
          rejected: "Incident report rejected.",
        };
        const response = await api.put(`/api/incidents/${id}/status`, {
          status: modActionStatus,
          message: modActionNote.trim() || defaultMessages[modActionStatus] || `Status updated to ${modActionStatus}`,
        });
        setIncident(response.data.incident);
      }
      setShowModAction(false);
    } catch (err) {
      console.error("Mod action error:", err);
      setError(err.response?.data?.message || "Failed to update incident.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmClose = async (e) => {
    e.preventDefault();
    if (!confirmMessage.trim()) return;

    try {
      setCloseLoading(true);
      setError("");

      const response = await api.put(`/api/incidents/${id}/status`, {
        status: "closed",
        message: confirmMessage,
      });

      setIncident(response.data.incident);
      setShowCloseConfirm(false);
    } catch (err) {
      console.error("Error closing incident:", err);
      setError(err.response?.data?.message || "Failed to confirm resolution and close incident.");
    } finally {
      setCloseLoading(false);
    }
  };

  const isAssignedStaff = incident && incident.assignedTo && (
    (typeof incident.assignedTo === "object" && (incident.assignedTo._id === currentUser?.id || incident.assignedTo.id === currentUser?.id)) ||
    incident.assignedTo === currentUser?.id
  );
  const isStaffOrMod = currentUser && ["staff", "moderator", "admin"].includes(currentUser.role);

  const handleStaffAction = (status) => {
    setStaffActionStatus(status);
    setStaffActionNote("");
    setStaffActionPhoto(null);
    setShowStaffAction(true);
  };

  const handleStaffActionSubmit = async (e) => {
    e.preventDefault();
    if (!incident || !staffActionStatus) return;

    const isWorkCompletion = incident.assignmentPhase !== "inspection" && staffActionStatus === "verified";

    // Require photo for work-phase completion
    if (isWorkCompletion && !staffActionPhoto) {
      setError("Please upload a completion photo as evidence before submitting.");
      return;
    }

    try {
      setSubmittingStaffReport(true);
      setError("");

      let photoUrl = null;

      // Upload photo if provided
      if (staffActionPhoto) {
        setStaffPhotoUploading(true);
        const formData = new FormData();
        formData.append("images", staffActionPhoto);
        const uploadRes = await api.post("/api/upload/images", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        photoUrl = uploadRes.data.urls?.[0] || uploadRes.data.images?.[0];
        setStaffPhotoUploading(false);
      }

      const res = await api.post(`/api/incidents/${id}/staff-report`, {
        status: staffActionStatus,
        message: staffActionNote,
        photo: photoUrl,
      });

      setIncident(res.data.incident);
      setShowStaffAction(false);
      setStaffActionStatus("");
      setStaffActionNote("");
      setStaffActionPhoto(null);
    } catch (err) {
      console.error("Error submitting staff report:", err);
      setError(err.response?.data?.message || "Failed to submit field report.");
      setStaffPhotoUploading(false);
    } finally {
      setSubmittingStaffReport(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      navigate("/login");
      return;
    }

    const trimmedComment = commentText.trim();
    if (!trimmedComment) {
      setError("Please enter a comment.");
      return;
    }

    if (trimmedComment.length > 1000) {
      setError("Comment cannot exceed 1000 characters.");
      return;
    }

    try {
      setCommentLoading(true);
      setError("");

      const response = await api.post(`/api/incidents/${id}/comments`, {
        message: trimmedComment,
      });

      setComments((previousComments) => [
        response.data.comment,
        ...previousComments,
      ]);
      setCommentText("");
    } catch (error) {
      console.error("Comment error:", error);
      setError(error.response?.data?.message || "Unable to add comment.");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      setDeletingCommentId(commentId);
      setError("");

      await api.delete(`/api/comments/${commentId}`);
      setComments((previousComments) =>
        previousComments.filter((comment) => comment._id !== commentId)
      );
    } catch (error) {
      console.error("Delete comment error:", error);
      setError(error.response?.data?.message || "Unable to delete comment.");
    } finally {
      setDeletingCommentId(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-wrap">
        <div className="spinner" />
      </div>
    );
  }

  if (error && !incident) {
    return <div className="page-container"><div className="error-wrap">{error}</div></div>;
  }

  if (!incident) {
    return <div className="page-container"><div className="empty-wrap"><h3>Incident not found</h3></div></div>;
  }

  return (
    <div className="page-container">
      {error && <div className="error-wrap" style={{ marginBottom: "24px" }}>{error}</div>}

      <div style={{ marginBottom: "32px" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px" }}>
          <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => navigate("/")}>
            Dashboard
          </span>{" "}
          / Incident #{incident._id?.slice(-6)}
        </div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>{incident.title}</h1>
      </div>

      <div className="incident-detail-grid">
        {/* Left Column - Details */}
        <div>
          <div className="detail-block">
            <h2 className="detail-block-title">Description</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6", whiteSpace: "pre-line" }}>
              {incident.description}
            </p>
          </div>

          <div className="detail-block">
            <h2 className="detail-block-title">Evidence Photos</h2>
            {incident.images?.length > 0 ? (
              <div className="image-gallery-grid">
                {incident.images.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="image-gallery-item"
                    onClick={() => setActivePhoto(image)}
                  >
                    <img src={image} alt={`Evidence ${index + 1}`} loading="lazy" />
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                No evidence photos uploaded for this incident.
              </p>
            )}
          </div>

          {incident.completionPhotos?.length > 0 && (
            <div className="detail-block">
              <h2 className="detail-block-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--accent-success)" }}>✓</span> Completion Evidence
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "12px" }}>
                Photos uploaded by field staff as proof of completed work.
              </p>
              <div className="image-gallery-grid">
                {incident.completionPhotos.map((photo, index) => (
                  <div
                    key={`completion-${photo}-${index}`}
                    className="image-gallery-item"
                    onClick={() => setActivePhoto(photo)}
                    style={{ border: "2px solid var(--accent-success)", borderRadius: "10px" }}
                  >
                    <img src={photo} alt={`Completion evidence ${index + 1}`} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-block">
            <h2 className="detail-block-title">Location Map</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "12px" }}>
              {incident.location?.address || "Address details unavailable"}
            </p>
            <IncidentMap incident={incident} />
          </div>

          <div className="detail-block">
            <h2 className="detail-block-title">Comments ({comments.length})</h2>

            {token ? (
              <form onSubmit={handleCommentSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                <textarea
                  className="form-textarea"
                  placeholder="Provide any updates or relevant municipal feedback..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength="1000"
                  rows="3"
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {commentText.length}/1000 characters
                  </span>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={commentLoading}>
                    {commentLoading ? "Posting..." : "Post Comment"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ padding: "16px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Sign in to participate in the civic discussion.
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/login")}>
                  Sign In
                </button>
              </div>
            )}

            <div className="comments-section">
              {comments.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", textAlign: "center", padding: "16px 0" }}>
                  No comments reported yet.
                </p>
              ) : (
                comments.map((comment) => {
                  const isOwner = comment.author?._id === currentUser?.id;
                  const commentAuthorInitial = comment.author?.name ? comment.author.name.charAt(0).toUpperCase() : "?";

                  return (
                    <article key={comment._id} className="comment-card">
                      <div className="comment-card-header">
                        <div className="comment-author-info">
                          <div className="nav-avatar" style={{ width: "24px", height: "24px", fontSize: "0.7rem" }}>
                            {commentAuthorInitial}
                          </div>
                          <span className="comment-author-name">
                            {comment.author?.name || "Unknown User"}
                          </span>
                          {comment.author?.role && (
                            <span className="comment-author-role">
                              {comment.author.role}
                            </span>
                          )}
                        </div>
                        <span className="comment-time">{timeAgo(comment.createdAt)}</span>
                      </div>

                      <div className="comment-content">{comment.message}</div>

                      {isOwner && (
                        <div className="comment-actions">
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: "3px 8px", fontSize: "0.75rem" }}
                            onClick={() => handleDeleteComment(comment._id)}
                            disabled={deletingCommentId === comment._id}
                          >
                            {deletingCommentId === comment._id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Status & Timeline Info */}
        <div>
          <div className="detail-block" style={{ padding: "20px" }}>
            <div className="upvote-panel">
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Confirm Issue Accuracy
              </span>
              {(!currentUser || currentUser.role === "citizen") ? (
                <>
                  <button
                    type="button"
                    className={`btn-upvote${hasUpvoted ? " active" : ""}`}
                    onClick={handleUpvote}
                    disabled={upvoteLoading}
                  >
                    <span>{hasUpvoted ? "Upvoted" : "Upvote"}</span>
                    <strong>{incident.upvotes?.length || 0}</strong>
                  </button>
                  {!token && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Authentication required to vote.
                    </span>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem" }}>{incident.upvotes?.length || 0}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    citizen votes (staff cannot upvote)
                  </span>
                </div>
              )}
            </div>
          </div>

          {isReporter && incident.status === "resolved" && (
            <div className="detail-block" style={{ padding: "20px", border: "1px solid var(--accent-success)", backgroundColor: "rgba(34, 197, 94, 0.05)" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--accent-success)", margin: 0 }}>
                Confirm Resolution
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "6px 0 12px 0", lineHeight: 1.4 }}>
                The moderators have marked this issue as resolved. Please confirm if it is fully resolved to close the report.
              </p>
              
              {showCloseConfirm ? (
                <form onSubmit={handleConfirmClose} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Enter confirm comment..."
                    value={confirmMessage}
                    onChange={(e) => setConfirmMessage(e.target.value)}
                    required
                    style={{ fontSize: "0.85rem", padding: "8px" }}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={closeLoading}
                      style={{ fontSize: "0.85rem" }}
                    >
                      {closeLoading ? "Closing..." : "Close Incident"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowCloseConfirm(false)}
                      disabled={closeLoading}
                      style={{ fontSize: "0.85rem" }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setShowCloseConfirm(true);
                    setConfirmMessage("Resolution confirmed by original reporter.");
                  }}
                >
                  Yes, it is resolved
                </button>
              )}
            </div>
          )}

          {isModerator && incident.status !== "closed" && incident.status !== "rejected" && (() => {
            const actions = [];
            const phase = incident.assignmentPhase;
            const staffOk = incident.staffStatus === "verified" || incident.staffStatus === "completed";

            if (incident.status === "reported") {
              actions.push({ label: "Assign Inspection Team", status: "assigned", phase: "inspection" });
              actions.push({ label: "Reject Report", status: "rejected" });
            } else if (incident.status === "verified") {
              actions.push({ label: "Assign Field Person to Task", status: "assigned", phase: "work" });
              actions.push({ label: "Reject Report", status: "rejected" });
            } else if (incident.status === "in_progress") {
              if (phase === "inspection" && staffOk) {
                actions.push({ label: "Mark Verified", status: "verified" });
                actions.push({ label: "Reject Report", status: "rejected" });
              } else if (phase === "inspection" && incident.staffStatus === "attention_needed") {
                actions.push({ label: "Reassign Inspection Team", status: "assigned", phase: "inspection" });
              } else if (phase === "inspection" && incident.staffStatus === "false_report") {
                actions.push({ label: "Reject Report", status: "rejected" });
              } else if (phase === "work" && staffOk) {
                actions.push({ label: "Mark as Resolved", status: "resolved" });
              } else if (phase === "work" && incident.staffStatus === "attention_needed") {
                actions.push({ label: "Reassign Field Person", status: "assigned", phase: "work" });
              } else if (phase === "work" && incident.staffStatus === "false_report") {
                actions.push({ label: "Reject Report", status: "rejected" });
              }
            }

            if (actions.length === 0) {
              let waiting = null;
              if (incident.status === "assigned" && phase === "inspection") {
                waiting = `Inspection assigned${incident.assignedTo?.name ? ` to ${incident.assignedTo.name}` : ""} — waiting for their report on Tasks.`;
              } else if (incident.status === "assigned" && phase === "work") {
                waiting = `Task assigned${incident.assignedTo?.name ? ` to ${incident.assignedTo.name}` : ""} — waiting for them to finish & report on Tasks.`;
              } else if (incident.status === "in_progress" && incident.staffStatus === "started") {
                waiting =
                  phase === "inspection"
                    ? "Inspection in progress — waiting for report on Tasks."
                    : "Work in progress — waiting for completion report on Tasks.";
              } else if (incident.status === "resolved") {
                waiting = "Resolved — waiting for citizen confirmation.";
              }
              if (!waiting) return null;
              return (
                <div className="detail-block" style={{ padding: "20px", border: "1px solid var(--border-color)" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Moderator Actions</h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "8px 0 0 0" }}>{waiting}</p>
                  {incident.assignmentPhase && (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "6px 0 0 0", textTransform: "capitalize" }}>
                      Phase: {incident.assignmentPhase} · Field: {incident.staffStatus?.replace(/_/g, " ")}
                    </p>
                  )}
                </div>
              );
            }

            return (
              <div className="detail-block" style={{ padding: "20px", border: "1px solid var(--accent-primary)", backgroundColor: "rgba(99, 102, 241, 0.05)" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--accent-primary)", margin: 0 }}>Moderator Actions</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "6px 0 12px 0" }}>
                  Inspection first, then assign the work task after the field report comes back.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {actions.map((action) => (
                    <button
                      key={action.status + (action.phase || "") + action.label}
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ width: "100%" }}
                      onClick={() => handleModAction(action.status, action.phase)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {isAssignedStaff && ["assigned", "in_progress"].includes(incident.status) && (() => {
            const isInspection = incident.assignmentPhase === "inspection";
            const isIdle = incident.staffStatus === "idle";
            const isStarted = incident.staffStatus === "started";

            if (!isIdle && !isStarted) return null;

            return (
              <div className="detail-block" style={{ padding: "20px", border: "1px solid var(--accent-success)", backgroundColor: "rgba(34, 197, 94, 0.05)" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--accent-success)", margin: 0 }}>Staff Actions</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "6px 0 12px 0" }}>
                  You are assigned to this {isInspection ? "inspection" : "work task"}. Update your progress below.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {isIdle && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ width: "100%" }}
                        onClick={() => handleStaffAction("started")}
                      >
                        {isInspection ? "Start Field Inspection" : "Start Work Task"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ width: "100%" }}
                        onClick={() => handleStaffAction("false_report")}
                      >
                        Report as False / Invalid
                      </button>
                    </>
                  )}
                  {isStarted && (
                    <>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        style={{ width: "100%" }}
                        onClick={() => handleStaffAction("verified")}
                      >
                        {isInspection ? "Confirm Issue & Report" : "Finish Work & Report"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ width: "100%" }}
                        onClick={() => handleStaffAction("attention_needed")}
                      >
                        Flag Attention Needed
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ width: "100%", color: "var(--accent-danger)" }}
                        onClick={() => handleStaffAction("false_report")}
                      >
                        Report as False / Invalid
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="detail-block">
            <h2 className="detail-block-title">Municipal Profile</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Category</span>
                <span className="info-value">{getCategoryLabel(incident.category)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Severity</span>
                <span className="info-value" style={{ textTransform: "capitalize" }}>{incident.severity}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Current Status</span>
                <span className="info-value" style={{ display: "inline-flex", alignItems: "center", gap: "6px", textTransform: "capitalize" }}>
                  <span className={`status-dot status-${incident.status}`} />
                  {incident.status?.replace("_", " ")}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Priority Score</span>
                <span className="info-value" style={{ fontFamily: "var(--font-mono)" }}>
                  {incident.priorityScore}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Reported By</span>
                <span className="info-value">{incident.reportedBy?.name || "Citizen"}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Date Reported</span>
                <span className="info-value">{new Date(incident.createdAt).toLocaleDateString()}</span>
              </div>
              {incident.assignedTo && (
                <>
                  <div className="info-item">
                    <span className="info-label">Assigned To</span>
                    <span className="info-value">{incident.assignedTo?.name || "Unassigned"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Assigned At</span>
                    <span className="info-value">{incident.assignedAt ? new Date(incident.assignedAt).toLocaleDateString() : "—"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Phase</span>
                    <span className="info-value" style={{ textTransform: "capitalize" }}>{incident.assignmentPhase || "—"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Crew Status</span>
                    <span className="info-value" style={{ textTransform: "capitalize", fontWeight: incident.staffStatus !== "idle" ? 700 : 400 }}>
                      {incident.staffStatus?.replace("_", " ") || "Idle"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="detail-block">
            <h2 className="detail-block-title">Resolution Timeline</h2>
            {incident.timeline?.length > 0 ? (
              <div className="timeline-flow">
                {incident.timeline.map((event, index) => (
                  <div key={`${event.timestamp}-${index}`} className="timeline-node active">
                    <div className="timeline-node-dot" />
                    <div className="timeline-node-status">{event.status?.replace("_", " ")}</div>
                    <div className="timeline-node-msg">{event.message}</div>
                    {event.updatedBy?.name && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        By: {event.updatedBy.name}
                      </div>
                    )}
                    <div className="timeline-node-time">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
                No timeline records available.
              </p>
            )}
          </div>

          {isStaffOrMod && (
            <div className="detail-block" style={{ border: "1px dashed var(--accent-primary)", background: "rgba(99, 102, 241, 0.02)" }}>
              <h2 className="detail-block-title" style={{ color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🔒</span> Internal Staff Timeline
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "-6px", marginBottom: "16px" }}>
                Visible only to field crew and moderators. Internal updates, reassignments, and progress notes.
              </p>
              {incident.internalTimeline?.length > 0 ? (
                <div className="timeline-flow">
                  {incident.internalTimeline.map((event, index) => (
                    <div key={`${event.timestamp}-${index}`} className="timeline-node active" style={{ borderColor: "var(--accent-primary)" }}>
                      <div className="timeline-node-dot" style={{ backgroundColor: "var(--accent-primary)" }} />
                      <div className="timeline-node-status" style={{ color: "var(--accent-primary)", textTransform: "capitalize" }}>
                        {event.status?.replace("_", " ")}
                      </div>
                      <div className="timeline-node-msg">{event.message}</div>
                      {event.updatedBy?.name && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          By: {event.updatedBy.name}
                        </div>
                      )}
                      <div className="timeline-node-time">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
                  No internal timeline logs yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div className="modal-backdrop" onClick={() => setActivePhoto(null)}>
          <button type="button" className="btn btn-secondary btn-sm" style={{ position: "absolute", top: "24px", right: "24px", color: "white" }}>
            Close
          </button>
          <img className="modal-content-img" src={activePhoto} alt="Evidence Lightbox View" />
        </div>
      )}

      {/* Moderator Action Dialog */}
      {showModAction && (
        <div className="mod-action-panel" onClick={() => setShowModAction(false)}>
          <div className="mod-action-card" onClick={(e) => e.stopPropagation()}>
            <h3>
              {modActionStatus === "assigned"
                ? modAssignPhase === "inspection"
                  ? "Assign Inspection Team"
                  : "Assign Field Person to Task"
                : modActionStatus === "resolved"
                  ? "Mark as Resolved"
                  : "Update Incident Status"}
            </h3>
            <p className="action-subtitle">
              {modActionStatus === "assigned"
                ? modAssignPhase === "inspection"
                  ? "Choose who will inspect this site and report back on Tasks."
                  : "Choose who will do the work and report completion on Tasks."
                : <>Transitioning to: <strong style={{ textTransform: "capitalize" }}>{modActionStatus?.replace("_", " ")}</strong></>}
            </p>
            <form onSubmit={handleModActionSubmit}>
              {modActionStatus === "assigned" && (
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label">
                    {modAssignPhase === "inspection"
                      ? "Who is on the inspection team?"
                      : "Who is assigned this field task?"}
                  </label>
                  <select className="form-select" value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} required>
                    <option value="">Select a person...</option>
                    {assignableUsers.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <textarea className="form-textarea" rows={3} placeholder="Add a note for the timeline..." value={modActionNote} onChange={(e) => setModActionNote(e.target.value)} />
              </div>
              <div className="action-buttons">
                <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}>{actionLoading ? "Updating..." : "Confirm"}</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModAction(false)} disabled={actionLoading}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Staff Action Dialog */}
      {showStaffAction && incident && (() => {
        const isInspection = incident.assignmentPhase === "inspection";
        const titleMap = {
          started: isInspection ? "Start Field Inspection" : "Start Work Task",
          verified: isInspection ? "Report Back: Issue Confirmed" : "Report Back: Work Finished",
          attention_needed: "Report Back: Attention Needed",
          false_report: "Report Back: False / Invalid",
        };
        const noteLabelMap = {
          started: "Notes (optional)",
          verified: isInspection ? "Inspection findings" : "What was completed?",
          attention_needed: "What needs attention?",
          false_report: "Why is this invalid/false?",
        };
        const placeholderMap = {
          started: isInspection ? "Arrived on site / initial observations..." : "Dispatch / site conditions...",
          verified: isInspection ? "Confirm the issue exists and note details for the moderator..." : "Describe the repair so the moderator can resolve the incident...",
          attention_needed: isInspection ? "Access blocked, unclear location, needs specialist..." : "Parts needed, hazards, blockers...",
          false_report: isInspection ? "Not found, already fixed, wrong location, duplicate..." : "Explain why this should be rejected...",
        };
        const confirmLabelMap = {
          started: isInspection ? "Start Inspection" : "Start Work",
          verified: "Send Report to Moderator",
          attention_needed: "Send Report to Moderator",
          false_report: "Send Report to Moderator",
        };

        const title = titleMap[staffActionStatus] || "Report Progress";
        const noteLabel = noteLabelMap[staffActionStatus] || "Note";
        const placeholder = placeholderMap[staffActionStatus] || "Enter report details...";
        const confirmLabel = confirmLabelMap[staffActionStatus] || "Submit";

        return (
          <div className="mod-action-panel" onClick={() => setShowStaffAction(false)}>
            <div className="mod-action-card" onClick={(e) => e.stopPropagation()}>
              <h3>{title}</h3>
              <p className="action-subtitle">
                This update goes to the moderator on the internal staff timeline.
                <br />
                Incident: <strong>{incident.title}</strong>
              </p>
                <form onSubmit={handleStaffActionSubmit}>
                <div className="form-group">
                  <label className="form-label">{noteLabel}</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder={placeholder}
                    value={staffActionNote}
                    onChange={(e) => setStaffActionNote(e.target.value)}
                    required={staffActionStatus !== "started"}
                  />
                </div>
                {/* Photo upload for work-phase completion */}
                {!isInspection && staffActionStatus === "verified" && (
                  <div className="form-group">
                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      📷 Completion Photo <span style={{ color: "var(--accent-danger)", fontSize: "0.8rem" }}>(required)</span>
                    </label>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 8px 0" }}>
                      Upload a photo of the completed work as evidence.
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setStaffActionPhoto(e.target.files[0] || null)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: "var(--bg-input, rgba(255,255,255,0.06))",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                      }}
                      required
                    />
                    {staffActionPhoto && (
                      <div style={{ marginTop: "8px", position: "relative", display: "inline-block" }}>
                        <img
                          src={URL.createObjectURL(staffActionPhoto)}
                          alt="Preview"
                          style={{ maxWidth: "200px", maxHeight: "150px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                        />
                        <button
                          type="button"
                          onClick={() => setStaffActionPhoto(null)}
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
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submittingStaffReport || staffPhotoUploading}>
                    {staffPhotoUploading ? "Uploading photo..." : submittingStaffReport ? "Sending..." : confirmLabel}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowStaffAction(false);
                      setStaffActionStatus("");
                      setStaffActionNote("");
                      setStaffActionPhoto(null);
                    }}
                    disabled={submittingStaffReport}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default IncidentDetails;