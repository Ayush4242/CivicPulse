const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");

dotenv.config();

const connectDB = require("./config/db");

const authRoutes = require(
  "./routes/authRoutes"
);

const incidentRoutes = require(
  "./routes/incidentRoutes"
);

const uploadRoutes = require(
  "./routes/uploadRoutes"
);

const commentRoutes = require(
  "./routes/commentRoutes"
);

connectDB();

const app = express();

// -----------------------------------------------------
// Middleware
// -----------------------------------------------------

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(morgan("dev"));

// -----------------------------------------------------
// API Routes
// -----------------------------------------------------

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/incidents",
  incidentRoutes
);

app.use(
  "/api/upload",
  uploadRoutes
);

/*
  commentRoutes already contains:

  /incidents/:id/comments
  /comments/:id

  Therefore mount directly at /api.
*/

app.use(
  "/api",
  commentRoutes
);

// -----------------------------------------------------
// Health / Home Route
// -----------------------------------------------------

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,

    message:
      "Welcome to CivicPulse API",
  });
});

// -----------------------------------------------------
// 404 Handler
// -----------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,

    message:
      `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// -----------------------------------------------------
// Global Error Handler
// -----------------------------------------------------

app.use(
  (err, req, res, next) => {
    console.error(err);

    let statusCode =
      res.statusCode === 200
        ? 500
        : res.statusCode;

    let message =
      err.message ||
      "Server Error";

    if (
      err.name ===
      "CastError"
    ) {
      statusCode = 400;

      message =
        "Invalid resource ID";
    }

    if (
      err.name ===
      "ValidationError"
    ) {
      statusCode = 400;

      message = Object.values(
        err.errors
      )
        .map(
          (error) =>
            error.message
        )
        .join(", ");
    }

    res.status(
      statusCode
    ).json({
      success: false,

      message,
    });
  }
);

// -----------------------------------------------------
// Start Server
// -----------------------------------------------------

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  () => {
    console.log(
      `🚀 CivicPulse server running on port ${PORT}`
    );
  }
);