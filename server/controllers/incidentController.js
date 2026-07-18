const asyncHandler = require("../utils/asyncHandler");
const Incident = require("../models/Incident");

// -----------------------------------------------------
// Priority score helper
// -----------------------------------------------------

const calculatePriorityScore = (severity) => {
  const severityScores = {
    low: 1,
    medium: 2,
    high: 3,
  };

  return severityScores[severity] || 2;
};

// -----------------------------------------------------
// @desc    Check for nearby duplicate incidents
// @route   POST /api/incidents/check-duplicates
// @access  Private
// -----------------------------------------------------

const checkDuplicates = asyncHandler(async (req, res) => {
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
    throw new Error("Invalid coordinates");
  }

  /*
    Search conditions:

    1. Same category
    2. Incident is not resolved/rejected
    3. Within 150 meters
  */

  const duplicates = await Incident.find({
    category,

    status: {
      $nin: ["resolved", "rejected"],
    },

    "location.coordinates": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
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

    count: duplicates.length,

    duplicates,
  });
});

// -----------------------------------------------------
// @desc    Create incident
// @route   POST /api/incidents
// @access  Private
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
      const lng = Number(longitude);
      const lat = Number(latitude);

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

        // GeoJSON = longitude first
        coordinates: [lng, lat],
      };
    }

    const incident =
      await Incident.create({
        title,

        description,

        category,

        severity: selectedSeverity,

        status: "reported",

        priorityScore:
          calculatePriorityScore(
            selectedSeverity
          ),

        location,

        images: Array.isArray(images)
          ? images
          : [],

        reportedBy: req.user.id,

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
// @desc    Get all incidents
// @route   GET /api/incidents
// @access  Public
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

    res.status(200).json({
      success: true,

      count: incidents.length,

      incidents,
    });
  }
);

// -----------------------------------------------------
// @desc    Get incident by ID
// @route   GET /api/incidents/:id
// @access  Public
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

    res.status(200).json({
      success: true,

      incident,
    });
  }
);

// -----------------------------------------------------
// @desc    Update incident
// @route   PUT /api/incidents/:id
// @access  Private
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
      req.body.severity !==
      undefined
    ) {
      incident.priorityScore =
        calculatePriorityScore(
          req.body.severity
        );
    }

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
// @desc    Delete incident
// @route   DELETE /api/incidents/:id
// @access  Private
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

module.exports = {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncident,
  deleteIncident,
  checkDuplicates,
};