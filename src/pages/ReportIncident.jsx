import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import LocationPicker from "../components/LocationPicker";

function ReportIncident() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      if (user && user.role !== "citizen") {
        navigate("/");
      }
    } catch {
      navigate("/");
    }
  }, [navigate]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "pothole",
    severity: "medium",
    address: "",
  });

  const [position, setPosition] = useState(null);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [resolvedNearby, setResolvedNearby] = useState([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [showResolvedWarning, setShowResolvedWarning] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setDuplicates([]);
    setResolvedNearby([]);
    setShowDuplicateWarning(false);
    setShowResolvedWarning(false);
  };

  const handleImageChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setError("");

    if (selectedFiles.length > 5) {
      setError("Maximum 5 images are allowed.");
      e.target.value = "";
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );

    if (invalidFile) {
      setError("Only JPG, PNG and WEBP images are allowed.");
      e.target.value = "";
      return;
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > 5 * 1024 * 1024
    );

    if (oversizedFile) {
      setError("Each image must be smaller than 5 MB.");
      e.target.value = "";
      return;
    }

    imagePreviews.forEach((preview) => {
      URL.revokeObjectURL(preview);
    });

    setImages(selectedFiles);
    const previews = selectedFiles.map((file) => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
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
        setDuplicates([]);
        setShowDuplicateWarning(false);
        setLocationLoading(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setError("Unable to access your location. Please select the location manually on the map.");
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const uploadImages = async () => {
    if (images.length === 0) {
      return [];
    }

    const imageData = new FormData();
    images.forEach((image) => {
      imageData.append("images", image);
    });

    const response = await api.post("/api/upload/images", imageData);
    return response.data.images || [];
  };

  const createIncident = async () => {
    setLoading(true);
    setError("");

    try {
      const uploadedImageUrls = await uploadImages();

      const incidentData = {
        ...formData,
        images: uploadedImageUrls,
        ...(position && {
          latitude: position.latitude,
          longitude: position.longitude,
        }),
      };

      const response = await api.post("/api/incidents", incidentData);
      navigate(`/incidents/${response.data.incident._id}`);
    } catch (error) {
      console.error("Incident submission error:", error);
      setError(error.response?.data?.message || "Unable to report incident.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!position) {
      await createIncident();
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/api/incidents/check-duplicates", {
        category: formData.category,
        latitude: position.latitude,
        longitude: position.longitude,
      });

      if (response.data.duplicatesFound) {
        setDuplicates(response.data.duplicates);
        setShowDuplicateWarning(true);
        setPendingSubmission(true);
        setLoading(false);
        return;
      }

      if (response.data.resolvedNearbyFound) {
        setResolvedNearby(response.data.resolvedNearby);
        setShowResolvedWarning(true);
        setPendingSubmission(true);
        setLoading(false);
        return;
      }

      setLoading(false);
      await createIncident();
    } catch (error) {
      console.error("Duplicate check error:", error);
      setError(error.response?.data?.message || "Unable to check for nearby incidents.");
      setLoading(false);
    }
  };

  const handleContinueAnyway = async () => {
    setShowDuplicateWarning(false);
    setShowResolvedWarning(false);
    setPendingSubmission(false);
    await createIncident();
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateWarning(false);
    setShowResolvedWarning(false);
    setPendingSubmission(false);
  };

  return (
    <div className="page-container-narrow">
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Report a Municipal Incident
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>
          File a official report to notify municipal officials about public infrastructure issues.
        </p>
      </div>

      {error && <div className="error-wrap">{error}</div>}

      {showDuplicateWarning && pendingSubmission && (
        <div className="duplicates-box">
          <h2 className="duplicates-box-title">Similar Incidents Already Exist Nearby</h2>
          <p className="duplicates-box-desc">
            We identified unresolved reports in this category within 150 meters. Please review them before proceeding.
          </p>

          <div className="duplicates-list">
            {duplicates.map((incident) => (
              <div key={incident._id} className="duplicate-row">
                {incident.images?.length > 0 && (
                  <img
                    className="duplicate-row-img"
                    src={incident.images[0]}
                    alt={incident.title}
                  />
                )}
                <div className="duplicate-row-info">
                  <h3 className="duplicate-row-title">{incident.title}</h3>
                  <div className="duplicate-row-meta">
                    <span>Status: {incident.status}</span>
                    <span>Severity: {incident.severity}</span>
                  </div>
                </div>
                <a
                  href={`/incidents/${incident._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: "none" }}
                >
                  View Details ↗
                </a>
              </div>
            ))}
          </div>

          <div className="duplicate-btn-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleContinueAnyway}
              disabled={loading}
            >
              Submit My Report Anyway
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCancelDuplicate}
              disabled={loading}
            >
              Go Back & Edit
            </button>
          </div>
        </div>
      )}

      {showResolvedWarning && pendingSubmission && (
        <div className="duplicates-box" style={{ borderColor: "var(--accent-warning)", background: "rgba(245, 158, 11, 0.06)" }}>
          <h2 className="duplicates-box-title" style={{ color: "var(--accent-warning)" }}>
            ⚠️ Previously Resolved Issue at This Location
          </h2>
          <p className="duplicates-box-desc">
            A similar <strong>{formData.category}</strong> report at this location was already filed and <strong>resolved/closed</strong>.
            If the issue has reoccurred, please confirm below. Otherwise, consider reviewing the previous report.
          </p>

          <div className="duplicates-list">
            {resolvedNearby.map((incident) => (
              <div key={incident._id} className="duplicate-row" style={{ borderColor: "var(--accent-warning)" }}>
                {incident.images?.length > 0 && (
                  <img
                    className="duplicate-row-img"
                    src={incident.images[0]}
                    alt={incident.title}
                  />
                )}
                <div className="duplicate-row-info">
                  <h3 className="duplicate-row-title">{incident.title}</h3>
                  <div className="duplicate-row-meta">
                    <span style={{ color: "var(--accent-success)", fontWeight: 600 }}>✅ {incident.status}</span>
                    <span>Severity: {incident.severity}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Reported by: {incident.reportedBy?.name || "Unknown"}
                  </div>
                </div>
                <a
                  href={`/incidents/${incident._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: "none" }}
                >
                  View Report ↗
                </a>
              </div>
            ))}
          </div>

          <div className="duplicate-btn-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleContinueAnyway}
              disabled={loading}
              style={{ background: "var(--accent-warning)" }}
            >
              ⚠️ Yes, Issue Has Reoccurred — Submit Report
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCancelDuplicate}
              disabled={loading}
            >
              Cancel & Go Back
            </button>
          </div>
        </div>
      )}

      {!showDuplicateWarning && !showResolvedWarning && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="form-group">
            <label className="form-label">Incident Title</label>
            <input
              className="form-input"
              type="text"
              name="title"
              placeholder="e.g., Pothole obstructing traffic on main road"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              name="description"
              placeholder="Provide a detailed description of the issue, indicating any specific hazards or blocking public access."
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              name="category"
              value={formData.category}
              onChange={handleChange}
            >
              <option value="pothole">Pothole</option>
              <option value="streetlight">Broken Streetlight</option>
              <option value="garbage">Garbage Pileup</option>
              <option value="water_leakage">Water Leakage</option>
              <option value="fallen_tree">Fallen Tree</option>
              <option value="open_manhole">Open Manhole</option>
              <option value="illegal_dumping">Illegal Dumping</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Severity Level</label>
            <select
              className="form-select"
              name="severity"
              value={formData.severity}
              onChange={handleChange}
            >
              <option value="low">Low (Minor nuisance, no safety risk)</option>
              <option value="medium">Medium (Standard issue, potential hazard)</option>
              <option value="high">High (Dangerous situation, urgent response needed)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Incident Photos</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageChange}
              style={{ display: "none" }}
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="btn btn-secondary"
              style={{ display: "inline-flex", width: "100%", justifyContent: "center" }}
            >
              Select Images ({images.length} Selected)
            </label>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block" }}>
              Upload up to 5 JPG, PNG or WEBP images. Maximum 5 MB each.
            </span>

            {imagePreviews.length > 0 && (
              <div className="image-previews">
                {imagePreviews.map((preview, index) => (
                  <div key={preview} className="image-preview-item">
                    <img src={preview} alt={`Preview ${index + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Address / Location Description</label>
            <input
              className="form-input"
              type="text"
              name="address"
              placeholder="e.g., Near 24th block crossroads, Central Avenue"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group" style={{ gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="form-label">Coordinates</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={getCurrentLocation}
                disabled={locationLoading}
              >
                {locationLoading ? "Detecting location..." : "Use Current Location"}
              </button>
            </div>

            {position && (
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                Selected: {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
              </span>
            )}

            <LocationPicker position={position} setPosition={setPosition} />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "16px" }}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Report Incident"}
          </button>
        </form>
      )}
    </div>
  );
}

export default ReportIncident;