import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import IncidentCard from "../components/IncidentCard";
import heroIllustration from "../assets/hero_illustration.png";
import emptyIllustration from "../assets/empty_illustration.png";

function Home() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  })();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const response = await api.get("/api/incidents");
        setIncidents(response.data.incidents || []);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to fetch incidents"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, []);

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch =
      !search ||
      incident.title.toLowerCase().includes(search.toLowerCase()) ||
      incident.description.toLowerCase().includes(search.toLowerCase()) ||
      incident.location?.address?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      !categoryFilter || incident.category === categoryFilter;

    const matchesStatus =
      !statusFilter || incident.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-inner">
            <h1>CivicPulse Incident Reporter</h1>
            <p>
              A professional platform for municipal infrastructure tracking,
              community upvoting, and status updates in real-time. Report issues,
              track resolutions, and improve your city.
            </p>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
              {(!currentUser || currentUser.role === "citizen") && (
                <Link to="/report" className="btn btn-primary">
                  Report Issue
                </Link>
              )}
              <a href="#incidents-section" className="btn btn-secondary">
                View Database
              </a>
            </div>

            {!loading && (
              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="hero-stat-val">{incidents.length}</span>
                  <span className="hero-stat-label">Total Reports</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-val">
                    {incidents.filter((i) => i.status === "resolved" || i.status === "closed").length}
                  </span>
                  <span className="hero-stat-label">Resolved</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-val">
                    {incidents.reduce((sum, i) => sum + (i.upvotes?.length || 0), 0)}
                  </span>
                  <span className="hero-stat-label">Upvotes</span>
                </div>
              </div>
            )}
          </div>

          <div className="hero-image-container">
            <img src={heroIllustration} alt="Civic reporting illustration" />
          </div>
        </div>
      </section>

      <div id="incidents-section" className="page-container">
        <div className="filter-row">
          <input
            className="form-input"
            type="text"
            placeholder="Search by title, description or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="form-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            <option value="pothole">Pothole</option>
            <option value="streetlight">Broken Streetlight</option>
            <option value="garbage">Garbage Pileup</option>
            <option value="water_leakage">Water Leakage</option>
            <option value="fallen_tree">Fallen Tree</option>
            <option value="open_manhole">Open Manhole</option>
            <option value="illegal_dumping">Illegal Dumping</option>
            <option value="other">Other</option>
          </select>

          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="verified">Verified</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {loading && (
          <div className="loading-wrap">
            <div className="spinner" />
          </div>
        )}

        {error && <div className="error-wrap">{error}</div>}

        {!loading && !error && filteredIncidents.length === 0 && (
          <div className="empty-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "40px" }}>
            <img src={emptyIllustration} alt="Empty database illustration" style={{ width: "200px", height: "auto", opacity: 0.6, animation: "float 6s ease-in-out infinite" }} />
            <h3>No incidents found</h3>
            <p style={{ maxWidth: "340px", margin: "0 auto" }}>
              Adjust your search query or filters to browse other reported issues.
            </p>
          </div>
        )}

        {!loading && !error && filteredIncidents.length > 0 && (
          <div className="incidents-grid">
            {filteredIncidents.map((incident) => (
              <IncidentCard key={incident._id} incident={incident} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default Home;