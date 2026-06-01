const express = require("express");
const ReviewController = require("../controller/reviewController");
const reviewModel = require("../models/reviewModel");
const { protect } = require("../middleware/authMiddleware");
const reviewController = new ReviewController(reviewModel);

const router = express.Router();

router.post("/", protect, async (req, res) => {
  try {
    const wishlist = await reviewController.addReview(req.body);
    if (!wishlist) {
      return res
        .status(404)
        .json({ success: false, message: "User or Place not found" });
    }

    res.status(200).json({
      success: true,
      data: wishlist,
      message: "Review added Successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.get("/", async (req, res) => {
  try {
    const { page, limit, sort, ...filters } = req.query;

    const wishlist = await reviewController.getReview(
      { page, limit, sort },
      filters,
    );
    if (!wishlist) {
      return res
        .status(404)
        .json({ success: false, message: "User or Place not found" });
    }
    res.status(200).json({
      success: true,
      data: wishlist.data,
      pagination: wishlist.pagination,
      ratings: wishlist.ratings,
      message: "reviews Fetched Successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.delete("/:userId/:placeId", protect, async (req, res) => {
  try {
    const { userId, placeId } = req.params;
    const realUserId = req.user.userId;
    if (req.user.role !== "Admin" && realUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have permission to delete this review.",
      });
    }

    const result = await reviewController.deleteReviewById(userId, placeId);

    res.status(200).json({
      success: true,
      data: result,
      message: "review deleted successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
