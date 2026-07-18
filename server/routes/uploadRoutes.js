const express = require("express");

const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const {
  uploadImages,
} = require("../controllers/uploadController");

const router = express.Router();

router.post(
  "/images",
  protect,
  upload.array("images", 5),
  uploadImages
);

module.exports = router;