const tripPhotoService = require("../services/tripPhotoService");
const { uploadSingle } = require("../middleware/s3Upload");

const ADMIN_ROLES = ["Admin", "SubAdmin"];

function handleError(res, error, fallback = "Request failed") {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || fallback,
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
}

exports.uploadPhoto = [
  uploadSingle("image"),
  async (req, res) => {
    try {
      if (!req.file?.location) {
        return res.status(400).json({ success: false, message: "Image file is required" });
      }

      const { tourId, caption } = req.body || {};
      if (!tourId) {
        return res.status(400).json({ success: false, message: "tourId is required" });
      }

      const data = await tripPhotoService.uploadTripPhoto({
        tourId,
        userId: req.user.userId,
        imageUrl: req.file.location,
        thumbnailUrl: req.file.location,
        caption,
      });

      return res.status(201).json({
        success: true,
        message: "Photo uploaded — pending moderation",
        data,
      });
    } catch (error) {
      return handleError(res, error, "Upload failed");
    }
  },
];

exports.getTourGallery = async (req, res) => {
  try {
    const userId = req.user?.userId || null;
    const data = await tripPhotoService.getApprovedTourPhotos(
      req.params.tourId,
      userId
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Failed to fetch gallery");
  }
};

exports.getMyTourPhotos = async (req, res) => {
  try {
    const data = await tripPhotoService.getMyTourPhotos(
      req.params.tourId,
      req.user.userId
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Failed to fetch your photos");
  }
};

exports.likePhoto = async (req, res) => {
  try {
    const data = await tripPhotoService.toggleLike(
      req.params.photoId,
      req.user.userId
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Like failed");
  }
};

exports.deletePhoto = async (req, res) => {
  try {
    await tripPhotoService.deleteOwnPhoto(req.params.photoId, req.user.userId);
    return res.status(200).json({ success: true, message: "Photo deleted" });
  } catch (error) {
    return handleError(res, error, "Delete failed");
  }
};

exports.getShareLink = async (req, res) => {
  try {
    const shareUrl = tripPhotoService.buildShareLink(req.params.photoId);
    return res.status(200).json({ success: true, data: { shareUrl } });
  } catch (error) {
    return handleError(res, error, "Share link failed");
  }
};

exports.getPendingPhotos = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const data = await tripPhotoService.getPendingPhotos();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Failed to fetch pending photos");
  }
};

exports.approvePhoto = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const data = await tripPhotoService.approvePhoto(
      req.params.id,
      req.user.userId
    );
    return res.status(200).json({
      success: true,
      message: "Photo approved",
      data,
    });
  } catch (error) {
    return handleError(res, error, "Approve failed");
  }
};

exports.bulkApprovePhotos = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const ids = req.body?.ids || [];
    const data = await tripPhotoService.bulkApprovePhotos(ids, req.user.userId);
    return res.status(200).json({
      success: true,
      message: `${data.modifiedCount} photo(s) approved`,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Bulk approve failed");
  }
};

exports.rejectPhoto = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    await tripPhotoService.rejectPhoto(req.params.id);
    return res.status(200).json({ success: true, message: "Photo rejected" });
  } catch (error) {
    return handleError(res, error, "Reject failed");
  }
};
