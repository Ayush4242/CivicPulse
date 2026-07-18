const asyncHandler = require("../utils/asyncHandler");
const Incident = require("../models/Incident");

// ---------------------------------------------
// @desc    Create a new incident
// @route   POST /api/incidents
// @access  Private
// ---------------------------------------------
const createIncident = asyncHandler(async (req, res) => {
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

  if (!title || !description || !category || !address) {
    res.status(400);
    throw new Error(
      "Title, description, category and address are required"
    );
  }

  const severityScore = {
    low: 1,
    medium: 2,
    high: 3,
  };

  const location = {
    address,
  };

  // Add GeoJSON only when coordinates are provided
  if (longitude !== undefined && latitude !== undefined) {
    location.coordinates = {
      type: "Point",
      coordinates: [Number(longitude), Number(latitude)],
    };
  }

  const incident = await Incident.create({
    title,
    description,
    category,
    severity: severity || "medium",

    priorityScore: severityScore[severity || "medium"],

    location,

    images: images || [],

    reportedBy: req.user.id,

    timeline: [
      {
        status: "reported",
        message: "Incident reported",
        updatedBy: req.user.id,
      },
    ],
  });

  const populatedIncident = await incident.populate(
    "reportedBy",
    "name email role"
  );

  res.status(201).json({
    success: true,
    message: "Incident reported successfully",
    incident: populatedIncident,
  });
});

// ---------------------------------------------
// @desc    Get all incidents
// @route   GET /api/incidents
// @access  Public
// ---------------------------------------------
const getIncidents = asyncHandler(async (req, res) => {
  const incidents = await Incident.find()
    .populate("reportedBy", "name role")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: incidents.length,
    incidents,
  });
});

// ---------------------------------------------
// @desc    Get single incident
// @route   GET /api/incidents/:id
// @access  Public
// ---------------------------------------------
const getIncidentById = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id)
    .populate("reportedBy", "name role reputation")
    .populate("timeline.updatedBy", "name role");

  if (!incident) {
    res.status(404);
    throw new Error("Incident not found");
  }

  res.status(200).json({
    success: true,
    incident,
  });
});

// ---------------------------------------------
// @desc    Update own incident
// @route   PUT /api/incidents/:id
// @access  Private
// ---------------------------------------------
const updateIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);

  if (!incident) {
    res.status(404);
    throw new Error("Incident not found");
  }

  // Only reporter can edit their incident for now
  if (incident.reportedBy.toString() !== req.user.id) {
    res.status(403);
    throw new Error("You are not authorized to update this incident");
  }

  // Citizens cannot directly manipulate moderation fields
  const allowedFields = [
    "title",
    "description",
    "category",
    "severity",
    "images",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      incident[field] = req.body[field];
    }
  });

  if (req.body.address !== undefined) {
    incident.location.address = req.body.address;
  }

  if (
    req.body.longitude !== undefined &&
    req.body.latitude !== undefined
  ) {
    incident.location.coordinates = {
      type: "Point",
      coordinates: [
        Number(req.body.longitude),
        Number(req.body.latitude),
      ],
    };
  }

  await incident.save();

  res.status(200).json({
    success: true,
    message: "Incident updated successfully",
    incident,
  });
});

// ---------------------------------------------
// @desc    Delete own incident
// @route   DELETE /api/incidents/:id
// @access  Private
// ---------------------------------------------
const deleteIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);

  if (!incident) {
    res.status(404);
    throw new Error("Incident not found");
  }

  if (incident.reportedBy.toString() !== req.user.id) {
    res.status(403);
    throw new Error("You are not authorized to delete this incident");
  }

  await incident.deleteOne();

  res.status(200).json({
    success: true,
    message: "Incident deleted successfully",
  });
});

module.exports = {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncident,
  deleteIncident,
};