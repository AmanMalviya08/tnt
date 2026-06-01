const express = require("express");
const CityController = require("../controller/cityController");
const CityModel = require("../models/cityModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const cityController = new CityController(CityModel);

router.post("/", protect,async (req, res) => {
  try {
    const city = await cityController.createCity(req.body);
    res
      .status(201)
      .json({ success: true, message: "City created successfully", data: city });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { page, limit, sort, sortBy, sortOrder, order, includeDisabled, ...filters } = req.query || {};

    const cities = await cityController.getCities(filters, {
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
      message: "Cities fetched successfully",
      data: cities.data,
      pagination: cities.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const city = await cityController.getCityById(req.params.id);
    if (!city) {
      return res.status(404).json({ success: false, message: "City not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "City fetched successfully", data: city });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id",protect, async (req, res) => {
  try {
    const city = await cityController.updateCity(req.params.id, req.body);
    if (!city) {
      return res.status(404).json({ success: false, message: "City not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "City updated successfully", data: city });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/disable",protect, async (req, res) => {
  try {
    const { isDisabled } = req.body || {};

    const city = await cityController.setCityDisabled(req.params.id, { isDisabled });
    if (!city) {
      return res.status(404).json({ success: false, message: "City not found" });
    }

    res.status(200).json({
      success: true,
      message: city.isDisabled ? "City disabled successfully" : "City enabled successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.delete("/:id",protect, async (req, res) => {
  try {
    await cityController.deleteCity(req.params.id);


    res.status(200).json({
      success: true,
      message: "city deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
