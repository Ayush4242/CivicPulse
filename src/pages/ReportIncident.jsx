import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import api from "../services/api";

import LocationPicker from "../components/LocationPicker";

function ReportIncident() {
  const navigate =
    useNavigate();

  const [formData, setFormData] =
    useState({
      title: "",
      description: "",
      category: "pothole",
      severity: "medium",
      address: "",
    });

  const [
    position,
    setPosition,
  ] = useState(null);

  const [
    images,
    setImages,
  ] = useState([]);

  const [
    imagePreviews,
    setImagePreviews,
  ] = useState([]);

  const [
    duplicates,
    setDuplicates,
  ] = useState([]);

  const [
    showDuplicateWarning,
    setShowDuplicateWarning,
  ] = useState(false);

  const [
    pendingSubmission,
    setPendingSubmission,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  // ---------------------------------------------------
  // Form fields
  // ---------------------------------------------------

  const handleChange = (e) => {
    setFormData({
      ...formData,

      [e.target.name]:
        e.target.value,
    });

    /*
      If category/address changes,
      previous duplicate results
      should no longer be trusted.
    */

    setDuplicates([]);

    setShowDuplicateWarning(
      false
    );
  };

  // ---------------------------------------------------
  // Image selection
  // ---------------------------------------------------

  const handleImageChange = (
    e
  ) => {
    const selectedFiles =
      Array.from(
        e.target.files
      );

    setError("");

    if (
      selectedFiles.length > 5
    ) {
      setError(
        "Maximum 5 images are allowed."
      );

      e.target.value = "";

      return;
    }

    const invalidFile =
      selectedFiles.find(
        (file) =>
          ![
            "image/jpeg",
            "image/png",
            "image/webp",
          ].includes(file.type)
      );

    if (invalidFile) {
      setError(
        "Only JPG, PNG and WEBP images are allowed."
      );

      e.target.value = "";

      return;
    }

    const oversizedFile =
      selectedFiles.find(
        (file) =>
          file.size >
          5 * 1024 * 1024
      );

    if (oversizedFile) {
      setError(
        "Each image must be smaller than 5 MB."
      );

      e.target.value = "";

      return;
    }

    imagePreviews.forEach(
      (preview) => {
        URL.revokeObjectURL(
          preview
        );
      }
    );

    setImages(selectedFiles);

    const previews =
      selectedFiles.map(
        (file) =>
          URL.createObjectURL(
            file
          )
      );

    setImagePreviews(
      previews
    );
  };

  // ---------------------------------------------------
  // Browser geolocation
  // ---------------------------------------------------

  const getCurrentLocation =
    () => {
      if (
        !navigator.geolocation
      ) {
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
            latitude:
              location.coords
                .latitude,

            longitude:
              location.coords
                .longitude,
          });

          setDuplicates([]);

          setShowDuplicateWarning(
            false
          );

          setLocationLoading(
            false
          );
        },

        (error) => {
          console.error(
            "Geolocation error:",
            error
          );

          setError(
            "Unable to access your location. Please select the location manually on the map."
          );

          setLocationLoading(
            false
          );
        },

        {
          enableHighAccuracy:
            true,

          timeout: 10000,

          maximumAge: 0,
        }
      );
    };

  // ---------------------------------------------------
  // Upload images
  // ---------------------------------------------------

  const uploadImages =
    async () => {
      if (
        images.length === 0
      ) {
        return [];
      }

      const imageData =
        new FormData();

      images.forEach(
        (image) => {
          imageData.append(
            "images",
            image
          );
        }
      );

      const response =
        await api.post(
          "/api/upload/images",
          imageData
        );

      return (
        response.data.images ||
        []
      );
    };

  // ---------------------------------------------------
  // Create incident
  // ---------------------------------------------------

  const createIncident =
    async () => {
      setLoading(true);

      setError("");

      try {
        const uploadedImageUrls =
          await uploadImages();

        const incidentData = {
          ...formData,

          images:
            uploadedImageUrls,

          ...(position && {
            latitude:
              position.latitude,

            longitude:
              position.longitude,
          }),
        };

        const response =
          await api.post(
            "/api/incidents",
            incidentData
          );

        navigate(
          `/incidents/${response.data.incident._id}`
        );
      } catch (error) {
        console.error(
          "Incident submission error:",
          error
        );

        setError(
          error.response?.data
            ?.message ||
            "Unable to report incident."
        );
      } finally {
        setLoading(false);
      }
    };

  // ---------------------------------------------------
  // Initial submission
  // ---------------------------------------------------

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      setError("");

      /*
        Duplicate detection requires
        GPS coordinates.

        If coordinates are unavailable,
        create the report normally.
      */

      if (!position) {
        await createIncident();

        return;
      }

      setLoading(true);

      try {
        const response =
          await api.post(
            "/api/incidents/check-duplicates",
            {
              category:
                formData.category,

              latitude:
                position.latitude,

              longitude:
                position.longitude,
            }
          );

        if (
          response.data
            .duplicatesFound
        ) {
          setDuplicates(
            response.data
              .duplicates
          );

          setShowDuplicateWarning(
            true
          );

          setPendingSubmission(
            true
          );

          setLoading(false);

          return;
        }

        setLoading(false);

        await createIncident();
      } catch (error) {
        console.error(
          "Duplicate check error:",
          error
        );

        /*
          A duplicate-check failure
          should not silently create
          the incident.

          Let the user retry instead.
        */

        setError(
          error.response?.data
            ?.message ||
            "Unable to check for nearby incidents."
        );

        setLoading(false);
      }
    };

  // ---------------------------------------------------
  // Continue despite warning
  // ---------------------------------------------------

  const handleContinueAnyway =
    async () => {
      setShowDuplicateWarning(
        false
      );

      setPendingSubmission(
        false
      );

      await createIncident();
    };

  // ---------------------------------------------------
  // Cancel duplicate warning
  // ---------------------------------------------------

  const handleCancelDuplicate =
    () => {
      setShowDuplicateWarning(
        false
      );

      setPendingSubmission(
        false
      );
  };

  return (
    <div>
      <h1>
        Report an Incident
      </h1>

      {error && (
        <p>{error}</p>
      )}

      {showDuplicateWarning &&
        pendingSubmission && (
          <section>
            <h2>
              Similar incidents
              already exist nearby
            </h2>

            <p>
              We found an
              unresolved incident
              of the same category
              within approximately
              150 metres.
            </p>

            <p>
              Check whether your
              issue has already
              been reported before
              creating another
              report.
            </p>

            {duplicates.map(
              (incident) => (
                <div
                  key={
                    incident._id
                  }
                >
                  {incident
                    .images
                    ?.length >
                    0 && (
                    <img
                      src={
                        incident
                          .images[0]
                      }
                      alt={
                        incident.title
                      }
                      width="180"
                    />
                  )}

                  <h3>
                    {
                      incident.title
                    }
                  </h3>

                  <p>
                    Status:{" "}
                    {
                      incident.status
                    }
                  </p>

                  <p>
                    Severity:{" "}
                    {
                      incident.severity
                    }
                  </p>

                  <p>
                    Location:{" "}
                    {incident
                      .location
                      ?.address ||
                      "Unknown"}
                  </p>

                  <p>
                    Upvotes:{" "}
                    {incident
                      .upvotes
                      ?.length ||
                      0}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/incidents/${incident._id}`
                      )
                    }
                  >
                    View Existing
                    Incident
                  </button>
                </div>
              )
            )}

            <button
              type="button"
              onClick={
                handleContinueAnyway
              }
              disabled={loading}
            >
              Report as New
              Incident Anyway
            </button>

            <button
              type="button"
              onClick={
                handleCancelDuplicate
              }
              disabled={loading}
            >
              Go Back
            </button>

            <hr />
          </section>
        )}

      {!showDuplicateWarning && (
        <form
          onSubmit={
            handleSubmit
          }
        >
          <div>
            <label>
              Incident Title
            </label>

            <input
              type="text"
              name="title"
              placeholder="Example: Large pothole near main road"
              value={
                formData.title
              }
              onChange={
                handleChange
              }
              required
            />
          </div>

          <div>
            <label>
              Description
            </label>

            <textarea
              name="description"
              placeholder="Describe the incident in detail"
              value={
                formData.description
              }
              onChange={
                handleChange
              }
              required
            />
          </div>

          <div>
            <label>
              Incident Photos
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={
                handleImageChange
              }
            />

            <p>
              Upload up to 5
              JPG, PNG or WEBP
              images. Maximum
              5 MB each.
            </p>

            {imagePreviews.length >
              0 && (
              <div>
                {imagePreviews.map(
                  (
                    preview,
                    index
                  ) => (
                    <img
                      key={
                        preview
                      }
                      src={
                        preview
                      }
                      alt={`Incident preview ${
                        index +
                        1
                      }`}
                      width="150"
                    />
                  )
                )}
              </div>
            )}
          </div>

          <div>
            <label>
              Category
            </label>

            <select
              name="category"
              value={
                formData.category
              }
              onChange={
                handleChange
              }
            >
              <option value="pothole">
                Pothole
              </option>

              <option value="streetlight">
                Broken
                Streetlight
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

          <div>
            <label>
              Severity
            </label>

            <select
              name="severity"
              value={
                formData.severity
              }
              onChange={
                handleChange
              }
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

          <div>
            <label>
              Address / Location
              Description
            </label>

            <input
              type="text"
              name="address"
              placeholder="Example: Main Road, Phagwara"
              value={
                formData.address
              }
              onChange={
                handleChange
              }
              required
            />
          </div>

          <div>
            <h3>
              Incident Location
            </h3>

            <button
              type="button"
              onClick={
                getCurrentLocation
              }
              disabled={
                locationLoading
              }
            >
              {locationLoading
                ? "Detecting location..."
                : "Use My Current Location"}
            </button>

            {position && (
              <p>
                Selected
                Location:{" "}
                {position.latitude.toFixed(
                  6
                )}
                ,{" "}
                {position.longitude.toFixed(
                  6
                )}
              </p>
            )}

            <LocationPicker
              position={
                position
              }
              setPosition={(
                newPosition
              ) => {
                setPosition(
                  newPosition
                );

                setDuplicates(
                  []
                );

                setShowDuplicateWarning(
                  false
                );
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Checking..."
              : "Report Incident"}
          </button>
        </form>
      )}
    </div>
  );
}

export default ReportIncident;