const express = require("express");

const router = express.Router();

const {
  registerUser,
  loginUser,
  getAssignableUsers,
  getAllUsers,
  updateUser,
  deleteUser,
  impersonateUser,
  switchRole,
  getActiveRoleUsers,
  getLeaderboard,
} = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");

router.post("/register", registerUser);

router.post("/login", loginUser);

router.get("/assignable-users", protect, getAssignableUsers);
router.get("/leaderboard", getLeaderboard);

// Presentation Dashboard Switcher Routes (Bypass/Switch across roles)
router.post("/switch-role", switchRole);
router.get("/active-roles", getActiveRoleUsers);

// Admin Routes
router.get("/users", protect, getAllUsers);
router.put("/users/:id", protect, updateUser);
router.delete("/users/:id", protect, deleteUser);
router.post("/users/impersonate", protect, impersonateUser);

module.exports = router;