const asyncHandler = require("../utils/asyncHandler");
const cloudinary = require("../config/cloudinary");

const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error("No images provided");
  }

  const uploadPromises = req.files.map((file) => {
    return new Promise((resolve, reject) => {
      const stream =
        cloudinary.uploader.upload_stream(
          {
            folder: "civicpulse/incidents",
            resource_type: "image",
          },

          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result.secure_url);
            }
          }
        );

      stream.end(file.buffer);
    });
  });

  const imageUrls = await Promise.all(uploadPromises);

  res.status(200).json({
    success: true,
    message: "Images uploaded successfully",
    images: imageUrls,
  });
});

module.exports = {
  uploadImages,
};