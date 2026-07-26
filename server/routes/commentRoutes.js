const express = require("express");

const {
  createComment,
  getIncidentComments,
  deleteComment,
} = require(
  "../controllers/commentController"
);

const protect = require(
  "../middleware/authMiddleware"
);

const router =
  express.Router();

// Get all comments for incident
router.get(
  "/incidents/:incidentId/comments",
  getIncidentComments
);

// Add comment to incident
router.post(
  "/incidents/:incidentId/comments",
  protect,
  createComment
);

// Delete own comment
router.delete(
  "/comments/:commentId",
  protect,
  deleteComment
);

module.exports = router;