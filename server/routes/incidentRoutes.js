const express = require("express");

const {
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
} = require(
  "../controllers/incidentController"
);

const protect = require(
  "../middleware/authMiddleware"
);

const router =
  express.Router();

// Duplicate detection
router.post(
  "/check-duplicates",
  protect,
  checkDuplicates
);

// Moderation stats (must be defined before /:id parameter matching)
router.get(
  "/moderation/stats",
  protect,
  getModerationStats
);

// Incident collection
router
  .route("/")
  .get(getIncidents)
  .post(
    protect,
    createIncident
  );

// Upvote
// Must be before /:id
router.post(
  "/:id/upvote",
  protect,
  toggleUpvote
);

// Individual incident
router
  .route("/:id")
  .get(getIncidentById)
  .put(
    protect,
    updateIncident
  )
  .delete(
    protect,
    deleteIncident
  );

router.put(
  "/:id/status",
  protect,
  updateIncidentStatus
);

router.patch(
  "/:id/assign",
  protect,
  assignIncident
);

router.post(
  "/:id/staff-report",
  protect,
  staffReport
);

module.exports = router;