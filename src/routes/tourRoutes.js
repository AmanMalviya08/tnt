const express = require("express");
const TourController = require("../controller/tourController");
const {
  tourModel,
  transportTypes,
  tourStatuses,
} = require("../models/tourModel");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();
const tourController = new TourController(tourModel);
const contryModel = require("../models/contryModel");
const cityModel = require("../models/cityModel");

router.post("/", protect, async (req, res) => {
  try {
    const tour = await tourController.createTour(req.body);
    res.status(201).json({
      success: true,
      message: "Tour created successfully",
      data: tour,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/toggle/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const tour = await tourController.toggleDisable(id);
    res
      .status(201)
      .json({ success: true, message: "successfull ", data: tour });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// router.get("/", async (req, res) => {
//   try {
//     const { page, limit, sort, ...filters } = req.query;
//     const tours = await tourController.getTours(filters, { page, limit, sort });
//     res.status(200).json({
//       success: true,
//       message: "Tours fetched successfully",
//       data: await tours,
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

router.get("/", async (req, res) => {
  try {
    const {
      page,
      limit,
      sort,
      city, // cityId
      country, // from cityId.countryId
      state, // from cityId.stateId
      min, // perPersonCost min
      max, // perPersonCost max
      minDuration, // durationInDays min
      maxDuration, // durationInDays max
      rating, // ratings.averageRating
      availableSeats, // filter by remaining seats
      startDate, // filter by start date
      endDate, // filter by end date
      ...otherFilters
    } = req.query;

    // Build filter object
    let filters = { ...otherFilters };

    // City filter
    if (city) {
      filters.cityId = city;
    }

    // Price range filter (perPersonCost)
    if (min !== undefined || max !== undefined) {
      filters.perPersonCost = {};
      if (min !== undefined) filters.perPersonCost.$gte = parseFloat(min);
      if (max !== undefined) filters.perPersonCost.$lte = parseFloat(max);
    }

    // Duration range filter (durationInDays)
    if (minDuration !== undefined || maxDuration !== undefined) {
      filters.durationInDays = {};
      if (minDuration !== undefined)
        filters.durationInDays.$gte = parseInt(minDuration);
      if (maxDuration !== undefined)
        filters.durationInDays.$lte = parseInt(maxDuration);
    }

    // Rating filter (ratings.averageRating)
    if (rating !== undefined) {
      filters["ratings.averageRating"] = { $gte: parseFloat(rating) };
    }

    // Available seats filter (remainingSeats)
    if (availableSeats !== undefined) {
      filters.remainingSeats = { $gte: parseInt(availableSeats) };
    }

    // Start date range filter
    if (startDate) {
      filters.startDate = { $gte: new Date(startDate) };
    }

    // End date range filter
    if (endDate) {
      filters.endDate = { $lte: new Date(endDate) };
    }

    // Search filter
    if (req.query.search && req.query.search.trim()) {
      filters.search = req.query.search.trim();
      delete otherFilters.search;
    }

    // Parse sort parameter
    let sortOptions = {};
    if (sort) {
      if (sort.startsWith("{")) {
        sortOptions = JSON.parse(sort);
      } else {
        const sortPairs = sort.split(",");
        sortPairs.forEach((pair) => {
          const [field, order] = pair.split(":");
          sortOptions[field.trim()] = parseInt(order) || -1;
        });
      }
    } else {
      sortOptions = { createdAt: -1 };
    }
    console.log(filters)
    const tours = await tourController.getTours(filters, {
      page,
      limit,
      sort: sortOptions,
      country,
      state,
    });

    res.status(200).json({
      success: true,
      message: "Tours fetched successfully",
      data: tours,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tour = await tourController.getTourById(req.params.id);
    if (!tour) {
      return res
        .status(404)
        .json({ success: false, message: "Tour not found" });
    }
    res.status(200).json({
      success: true,
      message: "Tour fetched successfully",
      data: tour,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id/seats", async (req, res) => {
  try {
    const tourSeats = await tourController.getTourSeats(req.params.id);
    if (!tourSeats) {
      return res
        .status(404)
        .json({ success: false, message: "Tour not found" });
    }
    res.status(200).json({
      success: true,
      message: "Seats fetched successfully",
      data: tourSeats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    console.log(req.body);
    const tour = await tourController.updateTour(req.params.id, req.body);
    if (!tour) {
      return res
        .status(404)
        .json({ success: false, message: "Tour not found" });
    }
    res.status(200).json({
      success: true,
      message: "Tour updated successfully",
      data: tour,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!tourStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value" });
    }

    const tour = await tourController.updateStatus(req.params.id, status);
    if (!tour) {
      return res
        .status(404)
        .json({ success: false, message: "Tour not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Tour status updated", data: tour });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const tour = await tourController.deleteTour(req.params.id);
    if (!tour) {
      return res
        .status(404)
        .json({ success: false, message: "Tour not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Tour deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/meta/enums", (req, res) => {
  res
    .status(200)
    .json({ success: true, data: { transportTypes, tourStatuses } });
});

router.get("/filter/data", async (req, res) => {
  try {
    // Query 1: Get all countries from contryModel (like package filter)
    const query1 = contryModel.aggregate([
      {
        $match: { isDisabled: false }, // Only active countries
      },
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

    // Query 2: Get unique states from tours (via cityId.stateId)
    const query2 = tourModel.aggregate([
      {
        $lookup: {
          from: "cities",
          localField: "cityId",
          foreignField: "_id",
          as: "city",
        },
      },
      { $unwind: { path: "$city", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "states",
          localField: "city.stateId",
          foreignField: "_id",
          as: "state",
        },
      },
      { $unwind: { path: "$state", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$state.stateName",
          id: { $first: "$state._id" },
        },
      },
      {
        $project: {
          _id: "$id",
          stateName: "$_id",
        },
      },
      { $sort: { stateName: 1 } },
    ]);

    // Query 3: Get all cities from cityModel (like package filter)
    const query3 = cityModel.aggregate([
      {
        $match: { isDisabled: false }, // Only active cities
      },
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

    // Query 4: Get min price (perPersonCost)
    const query4 = tourModel
      .find({ isDisabled: { $ne: true } })
      .sort({ perPersonCost: 1 })
      .limit(1)
      .select("perPersonCost");

    // Query 5: Get max price (perPersonCost)
    const query5 = tourModel
      .find({ isDisabled: { $ne: true } })
      .sort({ perPersonCost: -1 })
      .limit(1)
      .select("perPersonCost");

    // Query 6: Get min duration
    const query6 = tourModel
      .find({ isDisabled: { $ne: true } })
      .sort({ durationInDays: 1 })
      .limit(1)
      .select("durationInDays");

    // Query 7: Get max duration
    const query7 = tourModel
      .find({ isDisabled: { $ne: true } })
      .sort({ durationInDays: -1 })
      .limit(1)
      .select("durationInDays");

    const [
      countryData,
      stateData,
      cityData,
      minPrice,
      maxPrice,
      minDuration,
      maxDuration,
    ] = await Promise.all([
      query1,
      query2,
      query3,
      query4,
      query5,
      query6,
      query7,
    ]);

    const priceFilter = {
      min: minPrice[0]?.perPersonCost || 0,
      max: maxPrice[0]?.perPersonCost || 0,
    };

    const durationFilter = {
      min: minDuration[0]?.durationInDays || 0,
      max: maxDuration[0]?.durationInDays || 0,
    };

    const rating = [1, 2, 3, 4, 5];

    res.status(200).json({
      success: true,
      data: {
        countries: countryData,
        states: stateData,
        cities: cityData,
        priceFilter,
        durationFilter,
        rating,
      },
    });
  } catch (error) {
    console.error("Filter data error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;
