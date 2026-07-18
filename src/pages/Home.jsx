import { useEffect, useState } from "react";

import api from "../services/api";
import IncidentCard from "../components/IncidentCard";

function Home() {
  const [incidents, setIncidents] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {

    const fetchIncidents = async () => {

      try {

            const response = await api.get("/api/incidents");

      setIncidents(
        Array.isArray(response.data?.incidents)
          ? response.data.incidents
          : []
      );

    } catch (error) {

        setError(
          error.response?.data?.message ||
            "Unable to load incidents"
        );

      } finally {

        setLoading(false);

      }
    };

    fetchIncidents();

  }, []);

  if (loading) {
    return <p>Loading incidents...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div>

      <h1>Community Incidents</h1>

      {incidents.length === 0 ? (

        <p>No incidents reported yet.</p>

      ) : (

        incidents.map((incident) => (

          <IncidentCard
            key={incident._id}
            incident={incident}
          />

        ))

      )}

    </div>
  );
}

export default Home;