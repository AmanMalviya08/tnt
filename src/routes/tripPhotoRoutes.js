const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const tripPhotoController = require("../controller/tripPhotoController");

const router = express.Router();

router.post("/upload", protect, tripPhotoController.uploadPhoto);
router.get("/tour/:tourId/mine", protect, tripPhotoController.getMyTourPhotos);
router.get("/tour/:tourId", tripPhotoController.getTourGallery);
router.post("/photo/:photoId/like", protect, tripPhotoController.likePhoto);
router.delete("/photo/:photoId", protect, tripPhotoController.deletePhoto);
router.get("/photo/:photoId/share-link", tripPhotoController.getShareLink);

module.exports = router;
