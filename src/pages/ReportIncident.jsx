import { useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import LocationPicker from "../components/LocationPicker";

function ReportIncident() {
  const navigate = useNavigate();

  // Incident form data
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "pothole",
    severity: "medium",
    address: "",
  });

  // Map position
  const [position, setPosition] = useState(null);

  // UI states
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Get user's current GPS location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    setLocationLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (location) => {
        setPosition({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        setLocationLoading(false);
      },

      (error) => {
        console.error("Geolocation error:", error);

        setError(
          "Unable to access your location. Please select the location manually on the map."
        );

        setLocationLoading(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Submit incident
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      // Combine form data with selected coordinates
      const incidentData = {
        ...formData,

        ...(position && {
          latitude: position.latitude,
          longitude: position.longitude,
        }),
      };

      const response = await api.post(
        "/api/incidents",
        incidentData
      );

      // Redirect to newly created incident
      navigate(
        `/incidents/${response.data.incident._id}`
      );
    } catch (error) {
      console.error("Incident submission error:", error);

      setError(
        error.response?.data?.message ||
          "Unable to report incident"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Report an Incident</h1>

      {error && (
        <p>
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit}>

        {/* Title */}

        <div>
          <label>Incident Title</label>

          <input
            type="text"
            name="title"
            placeholder="Example: Large pothole near main road"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        {/* Description */}

        <div>
          <label>Description</label>

          <textarea
            name="description"
            placeholder="Describe the incident in detail"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>

        {/* Category */}

        <div>
          <label>Category</label>

          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
          >
            <option value="pothole">
              Pothole
            </option>

            <option value="streetlight">
              Broken Streetlight
            </option>

            <option value="garbage">
              Garbage
            </option>

            <option value="water_leakage">
              Water Leakage
            </option>

            <option value="fallen_tree">
              Fallen Tree
            </option>

            <option value="open_manhole">
              Open Manhole
            </option>

            <option value="illegal_dumping">
              Illegal Dumping
            </option>

            <option value="other">
              Other
            </option>
          </select>
        </div>

        {/* Severity */}

        <div>
          <label>Severity</label>

          <select
            name="severity"
            value={formData.severity}
            onChange={handleChange}
          >
            <option value="low">
              Low
            </option>

            <option value="medium">
              Medium
            </option>

            <option value="high">
              High
            </option>
          </select>
        </div>

        {/* Address */}

        <div>
          <label>Address / Location Description</label>

          <input
            type="text"
            name="address"
            placeholder="Example: Main Road, Phagwara"
            value={formData.address}
            onChange={handleChange}
            required
          />
        </div>

        {/* GPS */}

        <div>
          <h3>Incident Location</h3>

          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading
              ? "Detecting location..."
              : "Use My Current Location"}
          </button>

          {position && (
            <p>
              Selected Location:{" "}
              {position.latitude.toFixed(6)},{" "}
              {position.longitude.toFixed(6)}
            </p>
          )}
        </div>

        {/* Interactive Map */}

        <LocationPicker
          position={position}
          setPosition={setPosition}
        />

        {/* Submit */}

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Submitting..."
            : "Report Incident"}
        </button>

      </form>
    </div>
  );
}

export default ReportIncident;