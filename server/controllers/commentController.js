const asyncHandler = require("../utils/asyncHandler");

const Comment = require("../models/Comment");
const Incident = require("../models/Incident");

// -----------------------------------------------------
// Create comment
// POST /api/incidents/:incidentId/comments
// Private
// -----------------------------------------------------

const createComment = asyncHandler(
  async (req, res) => {
    const { incidentId } =
      req.params;

    const { message } =
      req.body;

    if (
      !message ||
      !message.trim()
    ) {
      res.status(400);

      throw new Error(
        "Comment message is required"
      );
    }

    if (
      message.trim().length > 1000
    ) {
      res.status(400);

      throw new Error(
        "Comment cannot exceed 1000 characters"
      );
    }

    const incident =
      await Incident.findById(
        incidentId
      );

    if (!incident) {
      res.status(404);

      throw new Error(
        "Incident not found"
      );
    }

    const comment =
      await Comment.create({
        incident:
          incidentId,

        author:
          req.user.id,

        message:
          message.trim(),
      });

    const populatedComment =
      await Comment.findById(
        comment._id
      ).populate(
        "author",
        "name role"
      );

    res.status(201).json({
      success: true,

      message:
        "Comment added successfully",

      comment:
        populatedComment,
    });
  }
);

// -----------------------------------------------------
// Get incident comments
// GET /api/incidents/:incidentId/comments
// Public
// -----------------------------------------------------

const getIncidentComments =
  asyncHandler(
    async (req, res) => {
      const { incidentId } =
        req.params;

      const incidentExists =
        await Incident.exists({
          _id: incidentId,
        });

      if (!incidentExists) {
        res.status(404);

        throw new Error(
          "Incident not found"
        );
      }

      const comments =
        await Comment.find({
          incident:
            incidentId,
        })
          .populate(
            "author",
            "name role"
          )
          .sort({
            createdAt: -1,
          });

      res.status(200).json({
        success: true,

        count:
          comments.length,

        comments,
      });
    }
  );

// -----------------------------------------------------
// Delete comment
// DELETE /api/comments/:commentId
// Private
// -----------------------------------------------------

const deleteComment =
  asyncHandler(
    async (req, res) => {
      const { commentId } =
        req.params;

      const comment =
        await Comment.findById(
          commentId
        );

      if (!comment) {
        res.status(404);

        throw new Error(
          "Comment not found"
        );
      }

      if (
        comment.author.toString() !==
        req.user.id
      ) {
        res.status(403);

        throw new Error(
          "You are not authorized to delete this comment"
        );
      }

      await comment.deleteOne();

      res.status(200).json({
        success: true,

        message:
          "Comment deleted successfully",

        commentId,
      });
    }
  );

module.exports = {
  createComment,
  getIncidentComments,
  deleteComment,
};