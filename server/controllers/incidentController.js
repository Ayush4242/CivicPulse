const asyncHandler = require("../utils/asyncHandler");
const Incident = require("../models/Incident");

// -----------------------------------------------------
// Calculate priority score
// -----------------------------------------------------

const calculatePriorityScore = (
  severity,
  upvoteCount = 0,
  createdAt = new Date()
) => {
  const severityScores = {
    low: 10,
    medium: 20,
    high: 30,
  };

  const severityScore =
    severityScores[severity] || 20;

  // Maximum 20 points from upvotes
  const upvoteScore = Math.min(
    upvoteCount,
    20
  );

  const createdDate =
    new Date(createdAt);

  const currentDate =
    new Date();

  const ageInMilliseconds =
    currentDate - createdDate;

  const ageInDays =
    Math.floor(
      ageInMilliseconds /
        (1000 * 60 * 60 * 24)
    );

  // Maximum 10 points from age
  const ageScore = Math.min(
    Math.max(ageInDays, 0),
    10
  );

  return (
    severityScore +
    upvoteScore +
    ageScore
  );
};

// -----------------------------------------------------
// Check nearby duplicates
// POST /api/incidents/check-duplicates
// Private
// -----------------------------------------------------

const checkDuplicates = asyncHandler(
  async (req, res) => {
    const {
      category,
      longitude,
      latitude,
    } = req.body;

    if (
      !category ||
      longitude === undefined ||
      latitude === undefined
    ) {
      return res.status(200).json({
        success: true,
        duplicatesFound: false,
        duplicates: [],
      });
    }

    const lng = Number(longitude);
    const lat = Number(latitude);

    if (
      Number.isNaN(lng) ||
      Number.isNaN(lat)
    ) {
      res.status(400);

      throw new Error(
        "Invalid coordinates"
      );
    }

    const duplicates =
      await Incident.find({
        category,

        status: {
          $nin: [
            "resolved",
            "rejected",
          ],
        },

        "location.coordinates": {
          $near: {
            $geometry: {
              type: "Point",

              coordinates: [
                lng,
                lat,
              ],
            },

            $maxDistance: 150,
          },
        },
      })
        .populate(
          "reportedBy",
          "name role"
        )
        .limit(5);

    res.status(200).json({
      success: true,

      duplicatesFound:
        duplicates.length > 0,

      count:
        duplicates.length,

      duplicates,
    });
  }
);

// -----------------------------------------------------
// Create incident
// POST /api/incidents
// Private
// -----------------------------------------------------

const createIncident = asyncHandler(
  async (req, res) => {
    const {
      title,
      description,
      category,
      severity,
      address,
      longitude,
      latitude,
      images,
    } = req.body;

    if (
      !title ||
      !description ||
      !category ||
      !address
    ) {
      res.status(400);

      throw new Error(
        "Title, description, category and address are required"
      );
    }

    const selectedSeverity =
      severity || "medium";

    const location = {
      address,
    };

    if (
      longitude !== undefined &&
      latitude !== undefined
    ) {
      const lng =
        Number(longitude);

      const lat =
        Number(latitude);

      if (
        Number.isNaN(lng) ||
        Number.isNaN(lat)
      ) {
        res.status(400);

        throw new Error(
          "Invalid location coordinates"
        );
      }

      location.coordinates = {
        type: "Point",

        coordinates: [
          lng,
          lat,
        ],
      };
    }

    const incident =
      await Incident.create({
        title,

        description,

        category,

        severity:
          selectedSeverity,

        status: "reported",

        priorityScore:
          calculatePriorityScore(
            selectedSeverity,
            0
          ),

        location,

        images:
          Array.isArray(images)
            ? images
            : [],

        reportedBy:
          req.user.id,

        upvotes: [],

        timeline: [
          {
            status: "reported",

            message:
              "Incident reported",

            updatedBy:
              req.user.id,
          },
        ],
      });

    const populatedIncident =
      await incident.populate(
        "reportedBy",
        "name email role"
      );

    res.status(201).json({
      success: true,

      message:
        "Incident reported successfully",

      incident:
        populatedIncident,
    });
  }
);

// -----------------------------------------------------
// Get all incidents
// GET /api/incidents
// Public
// -----------------------------------------------------

const getIncidents = asyncHandler(
  async (req, res) => {
    const incidents =
      await Incident.find()
        .populate(
          "reportedBy",
          "name role"
        )
        .sort({
          createdAt: -1,
        });

    /*
      Recalculate score when reading.

      This means age contributes even if
      nobody has recently updated the incident.
    */

    const updatedIncidents =
      incidents.map(
        (incident) => {
          const newScore =
            calculatePriorityScore(
              incident.severity,

              incident.upvotes
                ?.length || 0,

              incident.createdAt
            );

          incident.priorityScore =
            newScore;

          return incident;
        }
      );

    res.status(200).json({
      success: true,

      count:
        updatedIncidents.length,

      incidents:
        updatedIncidents,
    });
  }
);

// -----------------------------------------------------
// Get single incident
// GET /api/incidents/:id
// Public
// -----------------------------------------------------

const getIncidentById = asyncHandler(
  async (req, res) => {
    const incident =
      await Incident.findById(
        req.params.id
      )
        .populate(
          "reportedBy",
          "name role reputation"
        )
        .populate(
          "timeline.updatedBy",
          "name role"
        );

    if (!incident) {
      res.status(404);

      throw new Error(
        "Incident not found"
      );
    }

    incident.priorityScore =
      calculatePriorityScore(
        incident.severity,

        incident.upvotes
          ?.length || 0,

        incident.createdAt
      );

    res.status(200).json({
      success: true,

      incident,
    });
  }
);

// -----------------------------------------------------
// Update incident
// PUT /api/incidents/:id
// Private
// -----------------------------------------------------

const updateIncident = asyncHandler(
  async (req, res) => {
    const incident =
      await Incident.findById(
        req.params.id
      );

    if (!incident) {
      res.status(404);

      throw new Error(
        "Incident not found"
      );
    }

    if (
      incident.reportedBy.toString() !==
      req.user.id
    ) {
      res.status(403);

      throw new Error(
        "You are not authorized to update this incident"
      );
    }

    const allowedFields = [
      "title",
      "description",
      "category",
      "severity",
      "images",
    ];

    allowedFields.forEach(
      (field) => {
        if (
          req.body[field] !==
          undefined
        ) {
          incident[field] =
            req.body[field];
        }
      }
    );

    if (
      req.body.address !==
      undefined
    ) {
      incident.location.address =
        req.body.address;
    }

    if (
      req.body.longitude !==
        undefined &&
      req.body.latitude !==
        undefined
    ) {
      const lng = Number(
        req.body.longitude
      );

      const lat = Number(
        req.body.latitude
      );

      if (
        Number.isNaN(lng) ||
        Number.isNaN(lat)
      ) {
        res.status(400);

        throw new Error(
          "Invalid location coordinates"
        );
      }

      incident.location.coordinates = {
        type: "Point",

        coordinates: [
          lng,
          lat,
        ],
      };
    }

    incident.priorityScore =
      calculatePriorityScore(
        incident.severity,

        incident.upvotes
          ?.length || 0,

        incident.createdAt
      );

    await incident.save();

    res.status(200).json({
      success: true,

      message:
        "Incident updated successfully",

      incident,
    });
  }
);

// -----------------------------------------------------
// Delete incident
// DELETE /api/incidents/:id
// Private
// -----------------------------------------------------

const deleteIncident = asyncHandler(
  async (req, res) => {
    const incident =
      await Incident.findById(
        req.params.id
      );

    if (!incident) {
      res.status(404);

      throw new Error(
        "Incident not found"
      );
    }

    if (
      incident.reportedBy.toString() !==
      req.user.id
    ) {
      res.status(403);

      throw new Error(
        "You are not authorized to delete this incident"
      );
    }

    await incident.deleteOne();

    res.status(200).json({
      success: true,

      message:
        "Incident deleted successfully",
    });
  }
);

// -----------------------------------------------------
// Toggle incident upvote
// POST /api/incidents/:id/upvote
// Private
// -----------------------------------------------------

const toggleUpvote = asyncHandler(
  async (req, res) => {
    const incident =
      await Incident.findById(
        req.params.id
      );

    if (!incident) {
      res.status(404);

      throw new Error(
        "Incident not found"
      );
    }

    const userId =
      req.user.id;

    const existingUpvoteIndex =
      incident.upvotes.findIndex(
        (id) =>
          id.toString() ===
          userId
      );

    let upvoted;

    if (
      existingUpvoteIndex === -1
    ) {
      // User has not upvoted yet
      incident.upvotes.push(
        userId
      );

      upvoted = true;
    } else {
      // User already upvoted,
      // so remove it
      incident.upvotes.splice(
        existingUpvoteIndex,
        1
      );

      upvoted = false;
    }

    incident.priorityScore =
      calculatePriorityScore(
        incident.severity,

        incident.upvotes.length,

        incident.createdAt
      );

    await incident.save();

    res.status(200).json({
      success: true,

      message: upvoted
        ? "Incident upvoted successfully"
        : "Upvote removed successfully",

      upvoted,

      upvoteCount:
        incident.upvotes.length,

      upvotes:
        incident.upvotes,

      priorityScore:
        incident.priorityScore,
    });
  }
);

module.exports = {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncident,
  deleteIncident,
  checkDuplicates,
  toggleUpvote,
};