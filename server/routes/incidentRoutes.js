const express = require("express");

const {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncident,
  deleteIncident,
} = require("../controllers/incidentController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .get(getIncidents)
  .post(protect, createIncident);

router
  .route("/:id")
  .get(getIncidentById)
  .put(protect, updateIncident)
  .delete(protect, deleteIncident);

module.exports = router;