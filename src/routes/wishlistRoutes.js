
const express = require("express");
const WishlistController = require("../controller/wishlistController");
const wishlistModel = require("../models/wishlistModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const wishlistController = new WishlistController(wishlistModel);

router.post("/", protect, async (req, res) => {
  try {
    const result = await wishlistController.addWishlist(req.body);
    if (!result) {
      return res.status(404).json({ success: false, message: "User or Place not found" });
    }

    res.status(200).json({
      success: true,
      data: result.wishlist,
      action: result.action,
      place: result.place,
      message: `Wishlist ${result.action} Successfully`,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }


})
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params
    const realUserId = req.user.userId;
    if (req.user.role !== 'Admin' && realUserId !== id) {
      return res.status(403).json({ success: false, message: "Forbidden: You don't have permission to update the user." });
    }
    const { page, limit, sort, ...filters } = req.query;

    

    const wishlist = await wishlistController.getWishlist(id, { page, limit, sort }, filters);
    if (!wishlist) {
      return res.status(404).json({ success: false, message: "User or Place not found" });
    }

    res.status(200).json({
      success: true,
      data: wishlist.data,
      pagination: wishlist.pagination,
      message: "Wishlist Fetched Successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }


})

module.exports = router;

