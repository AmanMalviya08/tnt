// Routes (bannerRoutes.js)
const express = require("express");
const BannerController = require("../controller/bannerController");
const bannerModel = require("../models/bannerModel");
const { packageModel } = require("../models/packageModel");
const PackageController = require("../controller/packageController");
const packageController = new PackageController(packageModel);
const router = express.Router();
const bannerController = new BannerController(bannerModel);
const contryModel = require("../models/contryModel");
const ReviewController = require("../controller/reviewController");
const reviewModel = require("../models/reviewModel");
const { protect } = require("../middleware/authMiddleware");
const reviewController = new ReviewController(reviewModel);
router.post("/", protect, async (req, res) => {
  try {
    const banner = await bannerController.addBanner(req.body);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner failed to save",
      });
    }

    res.status(200).json({
      success: true,
      data: banner,
      message: "Banner added successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const banner = await bannerController.getBanner(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      success: true,
      data: banner,
      message: "Banner retrieved successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    console.log("sadad")
    const userId = req.user?.userId || undefined;
    const { page, limit, tourLimit, type, role, ...filter } = req.query;
    const result = await bannerController.getAllBanners(
      { page, limit, type, role },
      filter
    );
    const isDisabled = false;
    const popularTour = await packageController.getPackages(
      { userId, isDisabled },
      {
        sortBy: "ratings.averageRating",
        sort: { "ratings.averageRating": -1 },
        page: 1,
        limit: tourLimit,
      }
    );
    const countries = await contryModel.aggregate([
      {
        $group: {
          _id: "$contryName",
          id: { $first: "$_id" },
          image: { $first: "$image" },
        },
      },
      {
        $project: {
          _id: "$id",
          countryName: "$_id",
          image: 1,
        },
      },
    ]);
    const popularTourWithId = {
      _id: "popularTour",
      banners: popularTour.data,
    };
    const popularCountriesWithId = {
      _id: "popularCountries",
      banners: countries,
    };
    const testimonials = await reviewController.getDistinctTopReviews(5);

    const testimonialsWithId = {
      _id: "TESTIMONIALS",
      banners: testimonials,
    };

    result.data.push(popularTourWithId);
    result.data.push(popularCountriesWithId);
    result.data.push(testimonialsWithId);
    res.status(200).json({
      success: true,
      data: result.data,
      message: "Banners retrieved successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const banner = await bannerController.updateBanner(req.params.id, req.body);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner failed to save",
      });
    }

    res.status(200).json({
      success: true,
      data: banner,
      message: "Banner update successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await bannerController.deleteBanner(id);

    res.status(200).json({
      success: true,
      message: "Banners delete successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});
module.exports = router;
