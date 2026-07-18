import { Link } from "react-router-dom";

function IncidentCard({ incident }) {
  return (
    <article>

      <h2>{incident.title}</h2>

      <p>
        Category: {incident.category}
      </p>

      <p>
        Severity: {incident.severity}
      </p>

      <p>
        Status: {incident.status}
      </p>

      <p>
        Location: {incident.location?.address}
      </p>

      <p>
        Reported by:{" "}
        {incident.reportedBy?.name || "Unknown"}
      </p>

      <Link to={`/incidents/${incident._id}`}>
        View Details
      </Link>

    </article>
  );
}

export default IncidentCard;