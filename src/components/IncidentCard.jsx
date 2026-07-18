import { Link } from "react-router-dom";

function IncidentCard({ incident }) {
  return (
    <article>

      {incident.images?.length > 0 && (
        <img
          src={incident.images[0]}
          alt={incident.title}
          width="300"
          loading="lazy"
        />
      )}

      <h2>{incident.title}</h2>

      <p>
        {incident.description?.length > 150
          ? `${incident.description.slice(
              0,
              150
            )}...`
          : incident.description}
      </p>

      <p>
        <strong>Category:</strong>{" "}
        {incident.category}
      </p>

      <p>
        <strong>Severity:</strong>{" "}
        {incident.severity}
      </p>

      <p>
        <strong>Status:</strong>{" "}
        {incident.status}
      </p>

      <p>
        <strong>Location:</strong>{" "}
        {incident.location?.address ||
          "Location unavailable"}
      </p>

      <p>
        <strong>Reported by:</strong>{" "}
        {incident.reportedBy?.name ||
          "Unknown"}
      </p>

      <p>
        <strong>Upvotes:</strong>{" "}
        {incident.upvotes?.length || 0}
      </p>

      <Link
        to={`/incidents/${incident._id}`}
      >
        View Details
      </Link>

    </article>
  );
}

export default IncidentCard;