const express = require("express");
const PlaceController = require("../controller/placeController");
const {
  placeModel,
  accessibilityOptions,
  crowdLevels,
} = require("../models/placeModel");
const contryModel = require("../models/contryModel");
const cityModel = require("../models/cityModel");
const { packageModel } = require("../models/packageModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const placeController = new PlaceController(placeModel);

router.post("/", protect, async (req, res) => {
  try {
    const place = await placeController.createPlace(req.body);
    res.status(201).json({
      success: true,
      message: "Place created successfully",
      data: place,
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

    const places = await placeController.getPlaces(filters, {
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
      message: "Places fetched successfully",
      data: places.data,
      pagination: places.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const place = await placeController.getPlaceById(req.params.id);
    if (!place) {
      return res
        .status(404)
        .json({ success: false, message: "Place not found" });
    }
    res.status(200).json({
      success: true,
      message: "Place fetched successfully",
      data: place,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const place = await placeController.updatePlace(req.params.id, req.body);
    if (!place) {
      return res
        .status(404)
        .json({ success: false, message: "Place not found" });
    }
    res.status(200).json({
      success: true,
      message: "Place updated successfully",
      data: place,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/disable", protect, async (req, res) => {
  try {
    const { isDisabled } = req.body || {};

    const place = await placeController.setPlaceDisabled(req.params.id, {
      isDisabled,
    });
    if (!place) {
      return res
        .status(404)
        .json({ success: false, message: "Place not found" });
    }

    res.status(200).json({
      success: true,
      message: place.isDisabled
        ? "Place disabled successfully"
        : "Place enabled successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/filter/data", async (req, res) => {
  try {
    const query1 = contryModel.aggregate([
      {
        $group: {
          _id: "$contryName",
          id: { $first: "$_id" },
        },
      },
      {
        $project: {
          _id: "$id",
          countryName: "$_id",
        },
      },
      { $sort: { countryName: 1 } },
    ]);

    const query2 = cityModel.aggregate([
      {
        $group: {
          _id: "$cityName",
          id: { $first: "$_id" },
        },
      },
      {
        $project: {
          _id: "$id",
          cityName: "$_id",
        },
      },
      { $sort: { cityName: 1 } },
    ]);

    const query5 = packageModel
      .find({ isDisabled: false })
      .sort({ basePricePerPerson: 1 })
      .limit(1)
      .select("basePricePerPerson");
    const query6 = packageModel
      .find({ isDisabled: false })
      .sort({ basePricePerPerson: -1 })
      .limit(1)
      .select("basePricePerPerson");
    const [countryData, cityData, minPrice, maxPrice] = await Promise.all([
      query1,
      query2,
      query5,
      query6,
    ]);
    const priceFilter = {
      min: minPrice[0]?.basePricePerPerson || 0,
      max: maxPrice[0]?.basePricePerPerson || 0,
    };
    const durationDays = [1, 2, 3, 4, 5, 6, 7, 7 - 14, 14 - 30];
    const rating = [1, 2, 3, 4, 5];
    res.status(200).json({
      success: true,
      data: {
        countries: countryData,
        city: cityData,
        durationDays,
        rating,
        priceFilter,
        // tempo
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/meta/enums", (req, res) => {
  res
    .status(200)
    .json({ success: true, data: { accessibilityOptions, crowdLevels } });
});

router.delete("/:id", protect, async (req, res) => {
  try {
    await placeController.deletePlace(req.params.id);

    res.status(200).json({
      success: true,
      message: "place deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
