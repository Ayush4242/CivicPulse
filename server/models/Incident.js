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
        "closed",
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

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    // inspection = field check first; work = repair/task after inspection confirms
    assignmentPhase: {
      type: String,
      enum: ["inspection", "work"],
      default: null,
    },

    // Crew workflow: idle → started → verified | attention_needed | false_report
    // "completed" kept for legacy documents (treated as verified)
    staffStatus: {
      type: String,
      enum: [
        "idle",
        "started",
        "verified",
        "attention_needed",
        "false_report",
        "completed",
      ],
      default: "idle",
    },

    // Latest field report shown on Tasks for the moderator
    lastFieldReport: {
      outcome: { type: String, default: null },
      message: { type: String, default: null },
      photo: { type: String, default: null },
      reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reportedAt: { type: Date, default: null },
      phase: { type: String, default: null },
    },

    // Evidence photos uploaded by field staff on completion
    completionPhotos: [
      {
        type: String,
      },
    ],

    timeline: {
      type: [timelineSchema],
      default: [],
    },

    internalTimeline: {
      type: [timelineSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

incidentSchema.pre("save", async function () {
  if (this.location && this.location.coordinates) {
    if (
      !this.location.coordinates.coordinates ||
      this.location.coordinates.coordinates.length === 0
    ) {
      this.location.coordinates = undefined;
    }
  }
});

// Required later for nearby incident searches
incidentSchema.index({
  "location.coordinates": "2dsphere",
});

module.exports = mongoose.model("Incident", incidentSchema);