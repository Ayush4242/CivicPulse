const mongoose = require("mongoose");

const timelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const incidentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "pothole",
        "streetlight",
        "garbage",
        "water_leakage",
        "fallen_tree",
        "open_manhole",
        "illegal_dumping",
        "other",
      ],
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    status: {
      type: String,
      enum: [
        "reported",
        "verified",
        "assigned",
        "in_progress",
        "resolved",
        "rejected",
      ],
      default: "reported",
    },

    priorityScore: {
      type: Number,
      default: 0,
    },

    location: {
      address: {
        type: String,
        required: true,
        trim: true,
      },

      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },

        coordinates: {
          type: [Number],
          default: undefined,
        },
      },
    },

    images: [
      {
        type: String,
      },
    ],

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      default: null,
    },

    timeline: {
      type: [timelineSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Required later for nearby incident searches
incidentSchema.index({
  "location.coordinates": "2dsphere",
});

module.exports = mongoose.model("Incident", incidentSchema);