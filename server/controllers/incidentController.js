const asyncHandler = require("../utils/asyncHandler");
const Incident = require("../models/Incident");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

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
        resolvedNearby: [],
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

    const geoQuery = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        $maxDistance: 200,
      },
    };

    // 1. Check for ACTIVE duplicates (open/in-progress incidents)
    const duplicates =
      await Incident.find({
        category,
        status: {
          $nin: [
            "resolved",
            "rejected",
            "closed",
          ],
        },
        "location.coordinates": geoQuery,
      })
        .populate(
          "reportedBy",
          "name role"
        )
        .limit(5);

    // 2. Check for RESOLVED/CLOSED incidents at the same location & category
    const resolvedNearby =
      await Incident.find({
        category,
        status: {
          $in: ["resolved", "closed"],
        },
        "location.coordinates": geoQuery,
      })
        .populate(
          "reportedBy",
          "name role"
        )
        .sort({ updatedAt: -1 })
        .limit(5);

    res.status(200).json({
      success: true,

      duplicatesFound:
        duplicates.length > 0,

      resolvedNearbyFound:
        resolvedNearby.length > 0,

      count:
        duplicates.length,

      duplicates,
      resolvedNearby,
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
    if (req.user.role !== "citizen") {
      res.status(403);
      throw new Error("Only citizens can report incidents");
    }

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

    // Award +50 Karma to the citizen for filing a report
    await User.findByIdAndUpdate(req.user.id, { $inc: { reputation: 50 } });

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
    let isStaffOrMod = false;
    let loggedInUser = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        loggedInUser = decoded;
        if (["staff", "moderator", "admin"].includes(decoded.role)) {
          isStaffOrMod = true;
        }
      } catch (err) {
        // ignore
      }
    }

    let dbQuery = {};
    if (loggedInUser && loggedInUser.role === "staff") {
      dbQuery = { assignedTo: loggedInUser.id };
    }

    const incidents =
      await Incident.find(dbQuery)
        .populate(
          "reportedBy",
          "name role"
        )
        .populate(
          "assignedTo",
          "name email role"
        )
        .populate(
          "lastFieldReport.reportedBy",
          "name role"
        )
        .populate(
          "internalTimeline.updatedBy",
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

          const incidentObj = incident.toObject();
          incidentObj.priorityScore = newScore;

          if (!isStaffOrMod) {
            delete incidentObj.internalTimeline;
            delete incidentObj.lastFieldReport;
          }

          return incidentObj;
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
          "assignedTo",
          "name email role"
        )
        .populate(
          "lastFieldReport.reportedBy",
          "name role"
        )
        .populate(
          "timeline.updatedBy",
          "name role"
        )
        .populate(
          "internalTimeline.updatedBy",
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

    let isStaffOrMod = false;
    let loggedInUser = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        loggedInUser = decoded;
        if (["staff", "moderator", "admin"].includes(decoded.role)) {
          isStaffOrMod = true;
        }
      } catch (err) {
        // ignore
      }
    }

    if (loggedInUser && loggedInUser.role === "staff") {
      const assignedId = incident.assignedTo?._id?.toString() || incident.assignedTo?.toString();
      if (assignedId !== loggedInUser.id) {
        res.status(403);
        throw new Error("Access denied: You are not assigned to this incident");
      }
    }

    const incidentObj = incident.toObject();
    incidentObj.priorityScore = incident.priorityScore;

    if (!isStaffOrMod) {
      delete incidentObj.internalTimeline;
      delete incidentObj.lastFieldReport;
    }

    res.status(200).json({
      success: true,

      incident: incidentObj,
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

    // Only citizens can upvote
    if (req.user.role !== "citizen") {
      res.status(403);
      throw new Error("Only citizens can upvote incidents");
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

    if (upvoted) {
      await User.findByIdAndUpdate(userId, { $inc: { reputation: 10 } });
    } else {
      await User.findByIdAndUpdate(userId, { $inc: { reputation: -10 } });
    }

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

const updateIncidentStatus = asyncHandler(
  async (req, res) => {
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      res.status(404);
      throw new Error("Incident not found");
    }

    const { status } = req.body;
    let { message } = req.body;

    if (!status) {
      res.status(400);
      throw new Error("Status is required");
    }

    if (!message || !message.trim()) {
      message = `Incident status updated to ${status?.replace("_", " ")}`;
    }

    const isModeratorOrAdmin = ["moderator", "admin"].includes(req.user.role);
    const isOriginalReporter = incident.reportedBy.toString() === req.user.id;

    if (!isModeratorOrAdmin) {
      // Regular citizen can only transition resolved -> closed if they are the original reporter
      if (isOriginalReporter && status === "closed" && incident.status === "resolved") {
        // Allowed
      } else {
        res.status(403);
        throw new Error("You are not authorized to update this incident status");
      }
    }

    // State transition verification
    // Note: "verified" is set by a successful field inspection report (not desk-click).
    // Work assignment uses PATCH /assign with phase "work".
    const validTransitions = {
      reported: ["rejected", "verified"],
      verified: ["rejected", "assigned"],
      assigned: ["in_progress"],
      in_progress: ["verified", "resolved", "rejected"],
      resolved: ["closed"],
      rejected: [],
      closed: [],
    };

    const nextOptions = validTransitions[incident.status] || [];
    if (!nextOptions.includes(status)) {
      res.status(400);
      throw new Error(`Invalid status transition from ${incident.status} to ${status}`);
    }

    const reportedVerified = ["verified", "completed"].includes(incident.staffStatus);
    const reportedFalse = incident.staffStatus === "false_report";
    const isWorkPhase = incident.assignmentPhase === "work";
    const isInspectionPhase = incident.assignmentPhase === "inspection";

    // Resolve only after work crew reports task verified
    if (status === "resolved") {
      if (!isWorkPhase || !reportedVerified) {
        res.status(400);
        throw new Error(
          "Cannot resolve until the assigned work crew reports the task as verified"
        );
      }
    }

    // Verify only after inspection team reports verified
    if (status === "verified") {
      if (isInspectionPhase && !reportedVerified) {
        res.status(400);
        throw new Error(
          "Cannot verify until the assigned inspection team reports the issue as verified"
        );
      }
    }

    // Reject from in_progress only on false field/work report
    if (status === "rejected" && incident.status === "in_progress") {
      if (!reportedFalse) {
        res.status(400);
        throw new Error(
          "Cannot reject from in progress unless field staff reported a false report"
        );
      }
    }

    // Reject from verified (after inspection) is allowed anytime by moderator
    if (status === "rejected" && incident.status === "verified" && isInspectionPhase) {
      // ok — inspection confirmed issue but mod may still reject/duplicate
    }

    incident.status = status;

    incident.timeline.push({
      status,
      message,
      updatedBy: req.user.id,
      timestamp: new Date()
    });

    await incident.save();

    // Award Karma on key status transitions
    if (status === "verified" && isModeratorOrAdmin) {
      // Moderator verified the incident → +30 Karma to moderator
      await User.findByIdAndUpdate(req.user.id, { $inc: { reputation: 30 } });
    }
    if (status === "resolved" && incident.assignedTo) {
      // Incident resolved → +100 XP to the assigned staff
      await User.findByIdAndUpdate(incident.assignedTo, { $inc: { reputation: 100 } });
    }

    const updatedIncident = await Incident.findById(incident._id)
      .populate("reportedBy", "name role reputation")
      .populate("assignedTo", "name email role")
      .populate("lastFieldReport.reportedBy", "name role")
      .populate("timeline.updatedBy", "name role");

    res.status(200).json({
      success: true,
      message: `Incident status updated to ${status}`,
      incident: updatedIncident,
    });
  }
);

// -----------------------------------------------------
// Assign Incident — inspection first, then work task
// PATCH /api/incidents/:id/assign
// Body: { assignedTo, phase?: "inspection" | "work" }
// Private (Moderator/Admin)
// -----------------------------------------------------
const assignIncident = asyncHandler(async (req, res) => {
  const isModeratorOrAdmin = ["moderator", "admin"].includes(req.user.role);
  if (!isModeratorOrAdmin) {
    res.status(403);
    throw new Error("Only moderators and admins can assign incidents");
  }

  const incident = await Incident.findById(req.params.id);
  if (!incident) {
    res.status(404);
    throw new Error("Incident not found");
  }

  const { assignedTo } = req.body;
  let phase = req.body.phase;

  if (!assignedTo) {
    res.status(400);
    throw new Error("assignedTo user ID is required");
  }

  // Infer phase when omitted (legacy clients)
  if (!phase) {
    if (incident.status === "reported") phase = "inspection";
    else if (
      incident.status === "verified" ||
      (incident.assignmentPhase === "inspection" &&
        ["verified", "completed"].includes(incident.staffStatus))
    ) {
      phase = "work";
    } else if (
      incident.staffStatus === "attention_needed" &&
      incident.assignmentPhase
    ) {
      phase = incident.assignmentPhase;
    } else {
      phase = "inspection";
    }
  }

  if (!["inspection", "work"].includes(phase)) {
    res.status(400);
    throw new Error('phase must be "inspection" or "work"');
  }

  const targetUser = await User.findById(assignedTo).select("_id name email role");
  if (!targetUser) {
    res.status(404);
    throw new Error("Target user not found");
  }

  if (!["staff", "moderator", "admin"].includes(targetUser.role)) {
    res.status(400);
    throw new Error("Incident can only be assigned to a staff, moderator, or admin");
  }

  const inspectionConfirmed =
    incident.status === "verified" &&
    ["verified", "completed"].includes(incident.staffStatus);

  const reassignInspection =
    phase === "inspection" &&
    incident.assignmentPhase === "inspection" &&
    incident.staffStatus === "attention_needed" &&
    ["assigned", "in_progress"].includes(incident.status);

  const reassignWork =
    phase === "work" &&
    incident.assignmentPhase === "work" &&
    incident.staffStatus === "attention_needed" &&
    incident.status === "in_progress";

  if (phase === "inspection") {
    if (incident.status !== "reported" && !reassignInspection) {
      res.status(400);
      throw new Error(
        "Field inspection can only be assigned from a new report (or reassigned after attention-needed)"
      );
    }
  } else {
    // work phase — only after inspection confirmed the issue
    if (!inspectionConfirmed && !reassignWork) {
      res.status(400);
      throw new Error(
        "Assign a work task only after field inspection reports the issue as verified"
      );
    }
  }

  incident.status = "assigned";
  incident.assignedTo = targetUser._id;
  incident.assignedAt = new Date();
  incident.assignmentPhase = phase;
  incident.staffStatus = "idle";
  incident.lastFieldReport = {
    outcome: null,
    message: null,
    reportedBy: null,
    reportedAt: null,
    phase: null,
  };

  const assignMessage =
    phase === "inspection"
      ? reassignInspection
        ? `Reassigned for field inspection to ${targetUser.name}`
        : `Sent for field inspection to ${targetUser.name}`
      : reassignWork
        ? `Work task reassigned to ${targetUser.name}`
        : `Work task assigned to ${targetUser.name}`;

  incident.timeline.push({
    status: "assigned",
    message: assignMessage,
    updatedBy: req.user.id,
    timestamp: new Date(),
  });

  incident.internalTimeline.push({
    status: `assigned_${phase}`,
    message: assignMessage,
    updatedBy: req.user.id,
    timestamp: new Date(),
  });

  await incident.save();

  const updatedIncident = await Incident.findById(incident._id)
    .populate("reportedBy", "name role reputation")
    .populate("assignedTo", "name email role")
    .populate("lastFieldReport.reportedBy", "name role")
    .populate("timeline.updatedBy", "name role")
    .populate("internalTimeline.updatedBy", "name role");

  res.status(200).json({
    success: true,
    message: assignMessage,
    incident: updatedIncident,
  });
});

// -----------------------------------------------------
// Get Moderation Stats
// GET /api/incidents/moderation/stats
// Private (Moderator/Admin)
// -----------------------------------------------------
const getModerationStats = asyncHandler(async (req, res) => {
  const isModeratorOrAdmin = ["moderator", "admin"].includes(req.user.role);
  if (!isModeratorOrAdmin) {
    res.status(403);
    throw new Error("Only moderators and admins can access moderation stats");
  }

  const pipeline = [
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ];

  const results = await Incident.aggregate(pipeline);

  const stats = {
    totalActive: 0,
    reported: 0,
    verified: 0,
    assigned: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    rejected: 0,
    resolvedTotal: 0,
    pendingReview: 0,
  };

  results.forEach((item) => {
    const status = item._id;
    const count = item.count;
    if (status === "reported") stats.reported = count;
    else if (status === "verified") stats.verified = count;
    else if (status === "assigned") stats.assigned = count;
    else if (status === "in_progress") stats.inProgress = count;
    else if (status === "resolved") stats.resolved = count;
    else if (status === "closed") stats.closed = count;
    else if (status === "rejected") stats.rejected = count;
  });

  // Lifetime "resolved" KPI includes citizen-confirmed closed incidents
  stats.resolvedTotal = stats.resolved + stats.closed;
  stats.totalActive =
    stats.reported +
    stats.verified +
    stats.assigned +
    stats.inProgress +
    stats.resolved;

  stats.pendingReview = await Incident.countDocuments({
    $or: [
      // Inspection done — waiting for moderator to assign work task
      {
        status: "verified",
        assignmentPhase: "inspection",
        staffStatus: { $in: ["verified", "completed"] },
      },
      // Inspection or work report needing moderator action
      {
        status: { $in: ["assigned", "in_progress"] },
        staffStatus: { $in: ["attention_needed", "false_report"] },
      },
      // Work crew finished — waiting for resolve
      {
        status: "in_progress",
        assignmentPhase: "work",
        staffStatus: { $in: ["verified", "completed"] },
      },
    ],
  });

  res.status(200).json({
    success: true,
    stats,
  });
});

// -----------------------------------------------------
// Staff Progress / Field Report
// POST /api/incidents/:id/staff-report
// Private (Assigned Staff/Moderator or Admin)
//
// Inspection phase outcomes: verified | attention_needed | false_report
//   → verified promotes public status to "verified" so moderator can assign work
// Work phase outcomes: verified | attention_needed | false_report
//   → public status stays in_progress; moderator resolves/reassigns/rejects
// -----------------------------------------------------
const staffReport = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.id);
  if (!incident) {
    res.status(404);
    throw new Error("Incident not found");
  }

  const isAssigned = incident.assignedTo && incident.assignedTo.toString() === req.user.id;
  const isAdmin = req.user.role === "admin";
  const isModerator = req.user.role === "moderator";

  if (!isAssigned && !isAdmin && !isModerator) {
    res.status(403);
    throw new Error("Only the assigned staff or admin/moderator can submit progress reports");
  }

  if (!["assigned", "in_progress"].includes(incident.status)) {
    res.status(400);
    throw new Error("Staff can only report on assigned or in-progress incidents");
  }

  const phase = incident.assignmentPhase || "work";
  const isInspection = phase === "inspection";

  let { status, message, photo } = req.body;
  if (status === "completed") status = "verified";

  const allowed = ["started", "verified", "attention_needed", "false_report"];
  if (!status || !allowed.includes(status)) {
    res.status(400);
    throw new Error(
      "Valid report status is required: started, verified, attention_needed, or false_report"
    );
  }

  // Require photo evidence for work-phase completion
  if (!isInspection && status === "verified" && !photo) {
    res.status(400);
    throw new Error(
      "A completion photo is required as evidence when reporting work as completed"
    );
  }

  const outcomeLabels = isInspection
    ? {
        started: "Field inspection started",
        verified: "Inspection confirmed — issue is real",
        attention_needed: "Inspection needs attention",
        false_report: "Inspection found false / invalid report",
      }
    : {
        started: "Work started",
        verified: "Work completed and verified on site",
        attention_needed: "Work needs attention",
        false_report: "False report / reject recommendation",
      };

  const note = message?.trim() || outcomeLabels[status];

  const recordFieldReport = () => {
    incident.lastFieldReport = {
      outcome: status,
      message: note,
      photo: photo || null,
      reportedBy: req.user.id,
      reportedAt: new Date(),
      phase,
    };
    // Store completion evidence photo
    if (photo) {
      incident.completionPhotos.push(photo);
    }
  };

  if (status === "started") {
    if (!["idle", "started"].includes(incident.staffStatus)) {
      res.status(400);
      throw new Error(
        isInspection
          ? "Inspection can only be started when status is idle"
          : "Work can only be started when crew status is idle"
      );
    }

    incident.staffStatus = "started";
    incident.status = "in_progress";
    recordFieldReport();

    incident.timeline.push({
      status: "in_progress",
      message: isInspection ? `Field inspection started: ${note}` : `Work started: ${note}`,
      updatedBy: req.user.id,
      timestamp: new Date(),
    });

    incident.internalTimeline.push({
      status: "started",
      message: `${isInspection ? "Inspection" : "Work"} started: ${note}`,
      updatedBy: req.user.id,
      timestamp: new Date(),
    });
  } else {
    if (incident.staffStatus !== "started" && status !== "false_report") {
      res.status(400);
      throw new Error(
        isInspection
          ? "Start the field inspection before submitting a report"
          : "Start work before submitting a completion report"
      );
    }

    if (status === "false_report" && !["idle", "started"].includes(incident.staffStatus)) {
      res.status(400);
      throw new Error("False report can only be filed before a prior final report");
    }

    if (incident.status === "assigned") {
      incident.status = "in_progress";
      incident.timeline.push({
        status: "in_progress",
        message: isInspection
          ? `Field inspection update: ${note}`
          : `Field review in progress: ${note}`,
        updatedBy: req.user.id,
        timestamp: new Date(),
      });
    }

    incident.staffStatus = status;
    recordFieldReport();

    // Successful inspection → status remains in_progress for moderator to verify
    if (isInspection && status === "verified") {
      // We do not promote status automatically; moderator must do it manually
    }

    incident.internalTimeline.push({
      status,
      message: `${isInspection ? "Inspection" : "Work"} report (${outcomeLabels[status]}): ${note}`,
      updatedBy: req.user.id,
      timestamp: new Date(),
    });
  }

  await incident.save();

  const updatedIncident = await Incident.findById(incident._id)
    .populate("reportedBy", "name role reputation")
    .populate("assignedTo", "name email role")
    .populate("lastFieldReport.reportedBy", "name role")
    .populate("timeline.updatedBy", "name role")
    .populate("internalTimeline.updatedBy", "name role");

  res.status(200).json({
    success: true,
    message: isInspection
      ? "Field inspection report submitted"
      : "Work report submitted successfully",
    incident: updatedIncident,
  });
});

module.exports = {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncident,
  deleteIncident,
  checkDuplicates,
  toggleUpvote,
  updateIncidentStatus,
  assignIncident,
  getModerationStats,
  staffReport,
};