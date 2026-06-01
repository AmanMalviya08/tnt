const express = require("express");
const PackageController = require("../controller/packageController");
const {
  packageModel,
  packageTypes,
  mealOptions,
  transportOptions,
} = require("../models/packageModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const packageController = new PackageController(packageModel);

router.post("/", protect, async (req, res) => {
  try {
    const travelPackage = await packageController.createPackage(req.body);
    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: travelPackage,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const {
      page,
      limit,
      sort,
      sortBy,
      sortOrder,
      order,
      includeDisabled,
      ...filters
    } = req.query || {};
    console.log(req.query.isDisabled);
    const packages = await packageController.getPackages(filters, {
      page,
      limit,
      sort,
      sortBy,
      sortOrder,
      order,
      includeDisabled,
    });

    res.status(200).json({
      success: true,
      message: "Packages fetched successfully",
      data: packages.data,
      pagination: packages.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const travelPackage = await packageController.getPackageById(req.params.id);
    if (!travelPackage) {
      return res
        .status(404)
        .json({ success: false, message: "Package not found" });
    }
    res.status(200).json({
      success: true,
      message: "Package fetched successfully",
      data: travelPackage,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const travelPackage = await packageController.updatePackage(
      req.params.id,
      req.body,
    );
    if (!travelPackage) {
      return res
        .status(404)
        .json({ success: false, message: "Package not found" });
    }
    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      data: travelPackage,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/duplicate", protect, async (req, res) => {
  try {
    const duplicate = await packageController.duplicatePackage(req.params.id);
    if (!duplicate) {
      return res
        .status(404)
        .json({ success: false, message: "Package not found" });
    }
    res.status(201).json({
      success: true,
      message: "Package duplicated successfully",
      data: duplicate,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/disable", protect, async (req, res) => {
  try {
    const { isDisabled } = req.body || {};

    const travelPackage = await packageController.setPackageDisabled(
      req.params.id,
      { isDisabled },
    );
    if (!travelPackage) {
      return res
        .status(404)
        .json({ success: false, message: "Package not found" });
    }

    res.status(200).json({
      success: true,
      message: travelPackage.isDisabled
        ? "Package disabled successfully"
        : "Package enabled successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    await packageController.deletePackage(req.params.id);

    res.status(200).json({
      success: true,
      message: "package deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get("/meta/enums", (req, res) => {
  res.status(200).json({
    success: true,
    data: { packageTypes, mealOptions, transportOptions },
  });
});

module.exports = router;
