import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useNavigate,
} from "react-router-dom";

import api from "../services/api";

import IncidentMap from "../components/IncidentMap";

function IncidentDetails() {
  const { id } =
    useParams();

  const navigate =
    useNavigate();

  const [
    incident,
    setIncident,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    upvoteLoading,
    setUpvoteLoading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const token =
    localStorage.getItem(
      "token"
    );

  let currentUser = null;

  try {
    currentUser =
      JSON.parse(
        localStorage.getItem(
          "user"
        )
      );
  } catch {
    currentUser = null;
  }

  // ---------------------------------------
  // Fetch incident
  // ---------------------------------------

  useEffect(() => {
    const fetchIncident =
      async () => {
        try {
          setLoading(true);

          setError("");

          const response =
            await api.get(
              `/api/incidents/${id}`
            );

          setIncident(
            response.data
              .incident
          );
        } catch (error) {
          console.error(
            "Error fetching incident:",
            error
          );

          setError(
            error.response?.data
              ?.message ||
              "Unable to load incident."
          );
        } finally {
          setLoading(false);
        }
      };

    fetchIncident();
  }, [id]);

  // ---------------------------------------
  // Check if current user upvoted
  // ---------------------------------------

  const hasUpvoted =
    incident?.upvotes?.some(
      (userId) =>
        userId.toString() ===
        currentUser?.id
    ) || false;

  // ---------------------------------------
  // Toggle upvote
  // ---------------------------------------

  const handleUpvote =
    async () => {
      if (!token) {
        navigate("/login");

        return;
      }

      setUpvoteLoading(true);

      setError("");

      try {
        const response =
          await api.post(
            `/api/incidents/${id}/upvote`
          );

        setIncident(
          (previousIncident) => ({
            ...previousIncident,

            upvotes:
              response.data
                .upvotes,

            priorityScore:
              response.data
                .priorityScore,
          })
        );
      } catch (error) {
        console.error(
          "Upvote error:",
          error
        );

        setError(
          error.response?.data
            ?.message ||
            "Unable to update upvote."
        );
      } finally {
        setUpvoteLoading(false);
      }
    };

  // ---------------------------------------
  // Loading
  // ---------------------------------------

  if (loading) {
    return (
      <p>
        Loading incident...
      </p>
    );
  }

  if (error && !incident) {
    return <p>{error}</p>;
  }

  if (!incident) {
    return (
      <p>
        Incident not found.
      </p>
    );
  }

  return (
    <div>

      {error && (
        <p>{error}</p>
      )}

      {/* Header */}

      <section>
        <h1>
          {incident.title}
        </h1>

        <p>
          {
            incident.description
          }
        </p>
      </section>

      <hr />

      {/* Community verification */}

      <section>
        <h2>
          Community Verification
        </h2>

        <p>
          If you have seen or
          confirmed this issue,
          upvote it instead of
          creating another report.
        </p>

        <button
          type="button"
          onClick={
            handleUpvote
          }
          disabled={
            upvoteLoading
          }
        >
          {upvoteLoading
            ? "Updating..."
            : hasUpvoted
              ? `▲ Upvoted (${incident.upvotes?.length || 0})`
              : `△ Upvote (${incident.upvotes?.length || 0})`}
        </button>

        {!token && (
          <p>
            Login to confirm this
            incident.
          </p>
        )}
      </section>

      <hr />

      {/* Incident information */}

      <section>
        <h2>
          Incident Information
        </h2>

        <p>
          <strong>
            Category:
          </strong>{" "}
          {incident.category}
        </p>

        <p>
          <strong>
            Severity:
          </strong>{" "}
          {incident.severity}
        </p>

        <p>
          <strong>
            Status:
          </strong>{" "}
          {incident.status}
        </p>

        <p>
          <strong>
            Priority Score:
          </strong>{" "}
          {
            incident.priorityScore
          }
        </p>

        <p>
          <strong>
            Community Upvotes:
          </strong>{" "}
          {incident.upvotes
            ?.length || 0}
        </p>

        <p>
          <strong>
            Reported by:
          </strong>{" "}
          {incident.reportedBy
            ?.name ||
            "Unknown User"}
        </p>

        <p>
          <strong>
            Reported on:
          </strong>{" "}
          {incident.createdAt
            ? new Date(
                incident.createdAt
              ).toLocaleString()
            : "Unknown"}
        </p>
      </section>

      <hr />

      {/* Images */}

      <section>
        <h2>
          Evidence Photos
        </h2>

        {incident.images
          ?.length > 0 ? (
          <div>
            {incident.images.map(
              (
                image,
                index
              ) => (
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
            No evidence photos
            uploaded.
          </p>
        )}
      </section>

      <hr />

      {/* Location */}

      <section>
        <h2>
          Location
        </h2>

        <p>
          {incident.location
            ?.address ||
            "Address unavailable"}
        </p>

        <IncidentMap
          incident={incident}
        />
      </section>

      <hr />

      {/* Timeline */}

      <section>
        <h2>
          Incident Timeline
        </h2>

        {incident.timeline
          ?.length > 0 ? (
          incident.timeline.map(
            (
              event,
              index
            ) => (
              <div
                key={`${event.timestamp}-${index}`}
              >
                <strong>
                  {event.status}
                </strong>

                <p>
                  {event.message}
                </p>

                {event.updatedBy
                  ?.name && (
                  <p>
                    Updated by:{" "}
                    {
                      event
                        .updatedBy
                        .name
                    }
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
            No timeline updates
            available.
          </p>
        )}
      </section>

    </div>
  );
}

export default IncidentDetails;