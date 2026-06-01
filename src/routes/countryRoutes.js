const express = require("express");
const CountryController = require("../controller/countryController");
const contryModel = require("../models/contryModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const countryController = new CountryController(contryModel);

router.post("/",protect, async (req, res) => {
  try {
    const country = await countryController.createCountry(req.body);
    res
      .status(201)
      .json({ success: true, message: "Country created successfully", data: country });
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

    const countries = await countryController.getCountries(filters, {
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
      message: "Countries fetched successfully",
      data: countries.data,
      pagination: countries.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const country = await countryController.getCountryById(req.params.id);
    if (!country) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Country fetched successfully", data: country });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id",protect, async (req, res) => {
  try {
    const country = await countryController.updateCountry(req.params.id, req.body);
    if (!country) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Country updated successfully", data: country });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/disable",protect, async (req, res) => {
  try {
    const { isDisabled } = req.body || {};

    const country = await countryController.setCountryDisabled(req.params.id, { isDisabled });
    if (!country) {
      return res.status(404).json({ success: false, message: "Country not found" });
    }

    res.status(200).json({
      success: true,
      message: country.isDisabled ? "Country disabled successfully" : "Country enabled successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
