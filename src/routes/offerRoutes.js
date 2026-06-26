const express = require("express");
const OfferController = require("../controller/offerController");
const offerModel = require("../models/offerModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const offerController = new OfferController(offerModel);
const ADMIN_ROLES = ["Admin", "SubAdmin"];

function requireAdmin(req, res, next) {
  if (!ADMIN_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  return next();
}

router.post("/", protect, requireAdmin, async (req, res) => {
  try {
    const offer = await offerController.addOffer({
      ...req.body,
      createdBy: req.user.userId,
    });

    if (!offer) {
      return res.status(400).json({ success: false, message: "Offer failed to save" });
    }

    return res.status(201).json({
      success: true,
      data: offer,
      message: "Offer added successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect, requireAdmin, async (req, res) => {
  try {
    const offer = await offerController.updateOffer(req.params.id, req.body);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }
    return res.status(200).json({
      success: true,
      data: offer,
      message: "Offer updated successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", protect, requireAdmin, async (req, res) => {
  try {
    const offer = await offerController.deleteOffer(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const offer = await offerController.getOffer(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }
    return res.status(200).json({
      success: true,
      data: offer,
      message: "Offer retrieved successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { page, limit, type, ...filter } = req.query;
    const result = await offerController.getAllOffers({ page, limit, type }, filter);

    return res.status(200).json({
      success: true,
      result,
      message: "Offers retrieved successfully",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
