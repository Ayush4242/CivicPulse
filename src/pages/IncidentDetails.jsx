import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import api from "../services/api";
import IncidentMap from "../components/IncidentMap";

function IncidentDetails() {
  const { id } = useParams();

  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchIncident = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          `/api/incidents/${id}`
        );

        setIncident(response.data.incident);
      } catch (error) {
        console.error(
          "Error fetching incident:",
          error
        );

        setError(
          error.response?.data?.message ||
            "Unable to load incident."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchIncident();
  }, [id]);

  if (loading) {
    return <p>Loading incident...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!incident) {
    return <p>Incident not found.</p>;
  }

  return (
    <div>

      <section>
        <h1>{incident.title}</h1>

        <p>{incident.description}</p>
      </section>

      <hr />

      <section>
        <h2>Incident Information</h2>

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
          <strong>Priority Score:</strong>{" "}
          {incident.priorityScore}
        </p>

        <p>
          <strong>Reported by:</strong>{" "}
          {incident.reportedBy?.name ||
            "Unknown User"}
        </p>

        <p>
          <strong>Reported on:</strong>{" "}
          {incident.createdAt
            ? new Date(
                incident.createdAt
              ).toLocaleString()
            : "Unknown"}
        </p>
      </section>

      <hr />

      <section>
        <h2>Evidence Photos</h2>

        {incident.images?.length > 0 ? (
          <div>
            {incident.images.map(
              (image, index) => (
                <img
                  key={`${image}-${index}`}
                  src={image}
                  alt={`Incident evidence ${
                    index + 1
                  }`}
                  width="300"
                  loading="lazy"
                />
              )
            )}
          </div>
        ) : (
          <p>
            No evidence photos uploaded.
          </p>
        )}
      </section>

      <hr />

      <section>
        <h2>Location</h2>

        <p>
          {incident.location?.address ||
            "Address unavailable"}
        </p>

        <IncidentMap incident={incident} />
      </section>

      <hr />

      <section>
        <h2>Community Activity</h2>

        <p>
          <strong>Upvotes:</strong>{" "}
          {incident.upvotes?.length || 0}
        </p>
      </section>

      <hr />

      <section>
        <h2>Incident Timeline</h2>

        {incident.timeline?.length > 0 ? (
          incident.timeline.map(
            (event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
              >
                <strong>
                  {event.status}
                </strong>

                <p>{event.message}</p>

                {event.updatedBy?.name && (
                  <p>
                    Updated by:{" "}
                    {event.updatedBy.name}
                  </p>
                )}

                <small>
                  {event.timestamp
                    ? new Date(
                        event.timestamp
                      ).toLocaleString()
                    : ""}
                </small>
              </div>
            )
          )
        ) : (
          <p>
            No timeline updates available.
          </p>
        )}
      </section>

    </div>
  );
}

export default IncidentDetails;