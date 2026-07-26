import { Link } from "react-router-dom";
import fallenTreeImg from "../assets/fallen_tree.png";
import garbageImg from "../assets/garbage.png";

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

const getCategoryFallbackImage = (category) => {
  if (category === "fallen_tree") return fallenTreeImg;
  if (category === "garbage" || category === "illegal_dumping") return garbageImg;
  return null;
};

function IncidentCard({ incident }) {
  const fallbackImg = getCategoryFallbackImage(incident.category);

  return (
    <Link to={`/incidents/${incident._id}`} className="incident-card">
      <div className="incident-card-image">
        {incident.images?.[0] ? (
          <img src={incident.images[0]} alt={incident.title} />
        ) : fallbackImg ? (
          <img src={fallbackImg} alt={incident.title} style={{ filter: "brightness(0.85)" }} />
        ) : (
          <div className="incident-card-placeholder">
            {getCategoryLabel(incident.category)}
          </div>
        )}
        <div className="incident-card-badges">
          <span className="card-badge">{incident.severity}</span>
        </div>
      </div>
      <div className="incident-card-body">
        <h3 className="incident-card-title">{incident.title}</h3>
        <p className="incident-card-desc">{incident.description}</p>
        
        <div className="incident-card-meta">
          <span className={`status-dot status-${incident.status}`} />
          <span style={{ textTransform: "capitalize" }}>{incident.status?.replace("_", " ")}</span>
          <span>•</span>
          <span>{incident.location?.address || "Location pending"}</span>
        </div>
      </div>
      <div className="incident-card-footer">
        <div className="card-stats">
          <div className="card-stat">
            <span>Upvotes</span>
            <strong>{incident.upvotes?.length || 0}</strong>
          </div>
          <div className="card-stat">
            <span>Comments</span>
            <strong>{incident.commentCount || 0}</strong>
          </div>
        </div>
        <span>{timeAgo(incident.createdAt)}</span>
      </div>
    </Link>
  );
}

export default IncidentCard;