const express = require("express");

const {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncident,
  deleteIncident,
  checkDuplicates,
} = require(
  "../controllers/incidentController"
);

const protect = require(
  "../middleware/authMiddleware"
);

const router = express.Router();

// Duplicate detection
router.post(
  "/check-duplicates",
  protect,
  checkDuplicates
);

// Incident collection
router
  .route("/")
  .get(getIncidents)
  .post(
    protect,
    createIncident
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

module.exports = router;