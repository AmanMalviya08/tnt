const mongoose = require("mongoose");
const {
  TripPhoto,
  MAX_PHOTOS_PER_USER_PER_TOUR,
} = require("../models/tripPhotoModel");
const { bookingModel } = require("../models/bookingModel");
const { deleteFileFromObjectStorage } = require("../middleware/s3Upload");

async function assertUserBookedOnTour(userId, tourId) {
  const booking = await bookingModel
    .findOne({
      userId,
      selectedTourId: tourId,
      bookingStatus: { $in: ["Confirmed", "Completed"] },
      paymentStatus: { $in: ["Paid", "Partial"] },
    })
    .lean();

  if (!booking) {
    const err = new Error("You must have a confirmed booking on this tour to upload photos");
    err.statusCode = 403;
    throw err;
  }

  return booking;
}

async function uploadTripPhoto({ tourId, userId, imageUrl, thumbnailUrl, caption }) {
  if (!mongoose.Types.ObjectId.isValid(tourId)) {
    const err = new Error("Invalid tour id");
    err.statusCode = 400;
    throw err;
  }

  await assertUserBookedOnTour(userId, tourId);

  const count = await TripPhoto.countDocuments({ tourId, uploadedBy: userId });
  if (count >= MAX_PHOTOS_PER_USER_PER_TOUR) {
    const err = new Error(`Maximum ${MAX_PHOTOS_PER_USER_PER_TOUR} photos per tour allowed`);
    err.statusCode = 400;
    throw err;
  }

  const photo = await TripPhoto.create({
    tourId,
    uploadedBy: userId,
    imageUrl,
    thumbnailUrl: thumbnailUrl || imageUrl,
    caption: caption || "",
    uploadedAt: new Date(),
  });

  return TripPhoto.findById(photo._id)
    .populate("uploadedBy", "firstName lastName")
    .populate("tourId", "tourName")
    .lean();
}

async function getApprovedTourPhotos(tourId, userId) {
  const filter = { tourId, isApproved: true };

  const photos = await TripPhoto.find(filter)
    .populate("uploadedBy", "firstName lastName")
    .sort({ uploadedAt: -1 })
    .lean();

  if (!userId) return photos;

  return photos.map((photo) => ({
    ...photo,
    isLiked: (photo.likedBy || []).some(
      (id) => String(id) === String(userId)
    ),
  }));
}

async function getMyTourPhotos(tourId, userId) {
  return TripPhoto.find({ tourId, uploadedBy: userId })
    .sort({ uploadedAt: -1 })
    .lean();
}

async function toggleLike(photoId, userId) {
  const photo = await TripPhoto.findById(photoId);
  if (!photo || !photo.isApproved) {
    const err = new Error("Photo not found");
    err.statusCode = 404;
    throw err;
  }

  const likedIndex = photo.likedBy.findIndex(
    (id) => String(id) === String(userId)
  );

  if (likedIndex >= 0) {
    photo.likedBy.splice(likedIndex, 1);
    photo.likesCount = Math.max(0, (photo.likesCount || 1) - 1);
  } else {
    photo.likedBy.push(userId);
    photo.likesCount = (photo.likesCount || 0) + 1;
  }

  await photo.save();
  return {
    likesCount: photo.likesCount,
    isLiked: likedIndex < 0,
  };
}

async function deleteOwnPhoto(photoId, userId) {
  const photo = await TripPhoto.findOne({ _id: photoId, uploadedBy: userId });
  if (!photo) {
    const err = new Error("Photo not found");
    err.statusCode = 404;
    throw err;
  }

  const urls = [photo.imageUrl, photo.thumbnailUrl].filter(Boolean);
  await TripPhoto.deleteOne({ _id: photo._id });

  for (const url of urls) {
    try {
      await deleteFileFromObjectStorage(url);
    } catch (err) {
      console.warn("[tripPhoto] S3 delete skipped:", err.message);
    }
  }

  return { deleted: true };
}

function buildShareLink(photoId) {
  const base =
    process.env.APP_DEEP_LINK_BASE ||
    process.env.FRONTEND_URL ||
    "https://zunjarraoyatra.com";
  return `${base.replace(/\/$/, "")}/trip-photo/${photoId}`;
}

async function getPendingPhotos() {
  return TripPhoto.find({ isApproved: false })
    .populate("uploadedBy", "firstName lastName")
    .populate("tourId", "tourName")
    .sort({ uploadedAt: -1 })
    .lean();
}

async function approvePhoto(photoId, adminUserId) {
  const photo = await TripPhoto.findById(photoId);
  if (!photo) {
    const err = new Error("Photo not found");
    err.statusCode = 404;
    throw err;
  }

  photo.isApproved = true;
  photo.approvedAt = new Date();
  photo.approvedBy = adminUserId;
  await photo.save();

  return TripPhoto.findById(photoId)
    .populate("uploadedBy", "firstName lastName")
    .populate("tourId", "tourName")
    .lean();
}

async function bulkApprovePhotos(ids = [], adminUserId) {
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) {
    const err = new Error("No valid photo ids provided");
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const result = await TripPhoto.updateMany(
    { _id: { $in: validIds }, isApproved: false },
    { $set: { isApproved: true, approvedAt: now, approvedBy: adminUserId } }
  );

  return { modifiedCount: result.modifiedCount || 0 };
}

async function rejectPhoto(photoId) {
  const photo = await TripPhoto.findById(photoId);
  if (!photo) {
    const err = new Error("Photo not found");
    err.statusCode = 404;
    throw err;
  }

  const urls = [photo.imageUrl, photo.thumbnailUrl].filter(Boolean);
  await TripPhoto.deleteOne({ _id: photo._id });

  for (const url of urls) {
    try {
      await deleteFileFromObjectStorage(url);
    } catch (err) {
      console.warn("[tripPhoto] S3 delete skipped:", err.message);
    }
  }

  return { deleted: true };
}

module.exports = {
  uploadTripPhoto,
  getApprovedTourPhotos,
  getMyTourPhotos,
  toggleLike,
  deleteOwnPhoto,
  buildShareLink,
  getPendingPhotos,
  approvePhoto,
  bulkApprovePhotos,
  rejectPhoto,
  MAX_PHOTOS_PER_USER_PER_TOUR,
};
