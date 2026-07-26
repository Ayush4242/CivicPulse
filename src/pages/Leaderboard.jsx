import { useState, useEffect } from "react";
import api from "../services/api";

function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState({
    citizens: [],
    staff: [],
    moderators: [],
    all: [],
  });
  const [activeTab, setActiveTab] = useState("citizens");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  })();

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/auth/leaderboard");
      if (res.data.leaderboard) {
        setLeaderboard(res.data.leaderboard);
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
      setError(err.response?.data?.message || "Failed to load leaderboard stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const currentList = leaderboard[activeTab] || [];
  const top3 = currentList.slice(0, 3);

  return (
    <div className="page-container" style={{ maxWidth: "1100px", padding: "32px 24px" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(59,130,246,0.05))",
          border: "1px solid var(--border-subtle)",
          borderRadius: "16px",
          padding: "32px",
          marginBottom: "32px",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ maxWidth: "700px" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-primary)" }}>
            🏆 Municipal Engagement & Recognition
          </span>
          <h1 style={{ fontSize: "2.1rem", fontWeight: 800, margin: "8px 0 12px 0", letterSpacing: "-0.02em" }}>
            Civic Karma & Leaderboard
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
            Earn Karma points by submitting verified infrastructure reports, upvoting community issues, and completing field repairs. Rise through the ranks and unlock prestigious civic badges!
          </p>
        </div>

        {/* Karma Points Guide */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border-subtle)"
          }}
        >
          <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>📝 Report Verified Issue</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-primary)" }}>+50 Karma</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>🛠️ Resolve Field Task</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-success)" }}>+100 XP</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 600 }}>👍 Upvote Issue</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-warning)" }}>+10 Karma</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "28px" }}>
        {[
          { key: "citizens", label: "👤 Citizen Champions", icon: "👤" },
          { key: "staff", label: "🛠️ Field Crew & Staff", icon: "🛠️" },
          { key: "moderators", label: "🛡️ Moderators", icon: "🛡️" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
              border: activeTab === tab.key ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
              background: activeTab === tab.key ? "rgba(99, 102, 241, 0.15)" : "var(--bg-card)",
              color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-secondary)",
              transition: "all 0.2s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-wrap">Loading leaderboard ranks...</div>
      ) : error ? (
        <div className="error-wrap">{error}</div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {top3.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
                marginBottom: "32px"
              }}
            >
              {top3.map((u, idx) => {
                const ranks = ["🥇 1st Place", "🥈 2nd Place", "🥉 3rd Place"];
                const crowns = ["👑", "⭐", "🎖️"];
                const colors = ["#f59e0b", "#94a3b8", "#b45309"];
                return (
                  <div
                    key={u.id}
                    style={{
                      background: "var(--bg-card)",
                      border: `1px solid ${colors[idx]}`,
                      borderRadius: "12px",
                      padding: "20px",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      boxShadow: idx === 0 ? "0 8px 24px rgba(245, 158, 11, 0.15)" : "none"
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: colors[idx], textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                      {ranks[idx]}
                    </div>
                    <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: `2px solid ${colors[idx]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: "10px" }}>
                      {crowns[idx]}
                    </div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 700 }}>{u.name}</h3>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "3px 10px",
                        borderRadius: "12px",
                        background: `${u.badge.color}20`,
                        color: u.badge.color,
                        marginBottom: "12px"
                      }}
                    >
                      {u.badge.icon} {u.badge.name}
                    </div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--accent-primary)" }}>
                      {u.reputation} <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>Karma</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="mod-table-wrap">
            <table className="mod-table">
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>Rank</th>
                  <th>Member</th>
                  <th>Civic Badge</th>
                  <th style={{ textAlign: "center" }}>
                    {activeTab === "staff" ? "Tasks Completed" : "Reports Filed"}
                  </th>
                  <th style={{ textAlign: "center" }}>Upvotes Earned</th>
                  <th style={{ textAlign: "right" }}>Karma Points</th>
                </tr>
              </thead>
              <tbody>
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="mod-no-data">
                      No members ranked in this category yet.
                    </td>
                  </tr>
                ) : (
                  currentList.map((u, idx) => {
                    const isSelf = currentUser && (currentUser.id === u.id || currentUser._id === u.id);
                    return (
                      <tr key={u.id} style={{ background: isSelf ? "rgba(99, 102, 241, 0.08)" : "transparent" }}>
                        <td style={{ fontWeight: 700, color: idx < 3 ? "var(--accent-warning)" : "var(--text-muted)" }}>
                          #{idx + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                            {u.name} {isSelf && <span style={{ fontSize: "0.7rem", color: "var(--accent-primary)" }}>(You)</span>}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{u.email}</div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              padding: "4px 10px",
                              borderRadius: "12px",
                              background: `${u.badge.color}15`,
                              color: u.badge.color,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <span>{u.badge.icon}</span>
                            <span>{u.badge.name}</span>
                          </span>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>
                          {activeTab === "staff" ? u.tasksResolved : u.reportsFiled}
                        </td>
                        <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                          👍 {u.totalUpvotes}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--accent-primary)" }}>
                            {u.reputation}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default Leaderboard;
