const mongoose = require("mongoose");
const { tourModel } = require("../models/tourModel");

class TourController {
  constructor(model = tourModel) {
    this.model = model;
  }

  async createTour(payload) {

    // Handle meetingPoint (convert to array if string)
    if (payload.meetingPoint && !Array.isArray(payload.meetingPoint)) {
      payload.meetingPoint = [payload.meetingPoint];
    }

    // Handle bookedSeatNumbers for upper/lower deck seats
    if (payload.bookedSeatNumbers && Array.isArray(payload.bookedSeatNumbers)) {
      payload.bookedSeats = payload.bookedSeatNumbers.length;

      // Separate booked seats by deck type
      const bookedLowerSeats = payload.bookedSeatNumbers.filter(s => s.endsWith("-L"));
      const bookedUpperSeats = payload.bookedSeatNumbers.filter(s => s.endsWith("-U"));
      const bookedLegacySeats = payload.bookedSeatNumbers.filter(s => !s.endsWith("-L") && !s.endsWith("-U"));

      // Generate lowerSeats array if totalLowerSeats is provided
      if (payload.totalLowerSeats) {
        payload.lowerSeats = Array.from({ length: payload.totalLowerSeats }, (_, i) => ({
          number: `${i + 1}-L`,
          status: bookedLowerSeats.includes(`${i + 1}-L`) ? "booked" : "available",
        }));
      }

      // Calculate totalUpperSeats and generate upperSeats array
      if (payload.totalSeats && payload.totalLowerSeats !== undefined) {
        payload.totalUpperSeats = Math.max(payload.totalSeats - payload.totalLowerSeats, 0);
        if (payload.totalUpperSeats > 0) {
          payload.upperSeats = Array.from({ length: payload.totalUpperSeats }, (_, i) => ({
            number: `${i + 1}-U`,
            status: bookedUpperSeats.includes(`${i + 1}-U`) ? "booked" : "available",
          }));
        }
      }

      // Legacy seats (for tours without upper/lower distinction)
      if (payload.totalSeats && !payload.totalLowerSeats && bookedLegacySeats.length > 0) {
        payload.seats = Array.from({ length: payload.totalSeats }, (_, i) => ({
          number: String(i + 1),
          status: bookedLegacySeats.includes(String(i + 1)) ? "booked" : "available",
        }));
      }
    }

    if (payload.totalSeats !== undefined && payload.bookedSeats !== undefined) {
      if (payload.bookedSeats > payload.totalSeats) {
        throw new Error("Booked seats cannot exceed total seats");
      }
      payload.remainingSeats = payload.totalSeats - payload.bookedSeats;
    }

    payload.remainingSeats = payload.totalSeats - (payload.bookedSeats || 0);
    const tour = new this.model(payload);

    if (payload.durationInDays <= 0) {
      throw new Error("Duration in days should be greater than or equal to 1");
    }
    return tour.save();
  }

  // async getTours(filter = {}, options = {}) {
  //   console.log("sdfsf", filter);
  //   const { userId, ...cleanFilter } = filter;
  //   const query = this.model
  //     .find(cleanFilter)
  //     .populate("cityId packageId")
  //     .populate({
  //       path: "GuideAllocation",
  //       populate: {
  //         path: "guideId",
  //       },
  //     });
  //   if (options.sort) {
  //     query.sort(options.sort);
  //   }

  //   if (options.limit) {
  //     query.limit(parseInt(options.limit, 10));
  //   }

  //   if (options.page && options.limit) {
  //     const page = Math.max(parseInt(options.page, 10), 1);
  //     const limit = parseInt(options.limit, 10);
  //     const skip = (page - 1) * limit;
  //     query.skip(skip);
  //   }

  //   return query;
  // }

  async getTours(filter = {}, options = {}) {
    console.log("Filters:", filter, "Options:", options);
    const { userId, country, state, ...cleanFilter } = filter;

    // Handle search filter (tourName, or associated Guide's fullName, email, experience)
    if (cleanFilter.search) {
      const searchRegex = new RegExp(cleanFilter.search, 'i');
      let matchingTourIdsFromGuides = [];

      try {
        const Guide = mongoose.model("Guide");
        const GuideAllocation = mongoose.model("GuideAllocation");

        // Find guides matching the search criteria
        const guideSearchFilter = {
          $or: [
            { fullName: searchRegex },
            { email: searchRegex }
          ]
        };

        // If search looks like a number, search experience too

        const parsedExp = parseInt(cleanFilter.search, 10);
        if (!isNaN(parsedExp)) {
          guideSearchFilter.$or.push({ experience: parsedExp });
        }

        const matchingGuides = await Guide.find(guideSearchFilter).select('_id');
        const guideIds = matchingGuides.map(g => g._id);

        if (guideIds.length > 0) {
          const matchingAllocations = await GuideAllocation.find({ guideId: { $in: guideIds } }).select('tourId');
          matchingTourIdsFromGuides = matchingAllocations.map(a => a.tourId);
        }
      } catch (err) {
        console.warn("Could not search guides for tours:", err.message);
      }

      const orConditions = [
        { tourName: searchRegex }
      ];

      if (matchingTourIdsFromGuides.length > 0) {
        orConditions.push({ _id: { $in: matchingTourIdsFromGuides } });
      }

      try {
        const City = mongoose.model("City");
        const matchingCities = await City.find({ cityName: searchRegex }).select('_id');
        const searchCityIds = matchingCities.map(c => c._id);
        if (searchCityIds.length > 0) {
          orConditions.push({ cityId: { $in: searchCityIds } });
        }
      } catch (err) {
        console.warn("Could not search cities for tours:", err.message);
      }

      cleanFilter.$or = orConditions;
      delete cleanFilter.search;
    }

    // Handle multiple cityIds (comma-separated)
    if (cleanFilter.cityId && typeof cleanFilter.cityId === 'string' && cleanFilter.cityId.includes(',')) {
      const cityIds = cleanFilter.cityId.split(',').map(id => id.trim()).filter(id => id);
      cleanFilter.cityId = { $in: cityIds };
    }

    const includeDisabled =
      options.includeDisabled === true || options.includeDisabled === "true";
    if (!includeDisabled && cleanFilter.isDisabled === undefined) {
      cleanFilter.isDisabled = false;
      cleanFilter.isActive = true;
      cleanFilter.status = { $nin: ["Draft", "Cancelled", "Completed"] };
    }

    let query = this.model.find(cleanFilter);

    // Populate cityId with country/state filter
    if (options.country || options.state) {
      const cityMatch = {};
      if (options.country) cityMatch.countryId = options.country;
      if (options.state) cityMatch.stateId = options.state;

      query = query.populate({
        path: "cityId",
        match: cityMatch,
      });
    } else {
      query = query.populate("cityId");
    }

    query = query.populate("packageId");

    query = query.populate({
      path: "GuideAllocation",
      populate: {
        path: "guideId",
      },
    });

    if (options.sort) {
      query.sort(options.sort);
    }

    if (options.limit) {
      query.limit(parseInt(options.limit, 10));
    }

    if (options.page && options.limit) {
      const page = Math.max(parseInt(options.page, 10), 1);
      const limit = parseInt(options.limit, 10);
      const skip = (page - 1) * limit;
      query.skip(skip);
    }

    console.log(options)
    const results = await query;

    if (options.country || options.state) {
      return results.filter((tour) => tour.cityId !== null);
    }

    return results;
  }

  async getTourById(id) {
    return this.model.findById(id).populate("cityId").populate({ path: "tourPlaces", select: "placeName" })
  }

  async getTourSeats(id) {
    const seatLockService = require("../services/seatLockService");
    await seatLockService.releaseExpiredLocks(id);

    const tour = await this.model
      .findById(id)
      .select("seats lowerSeats upperSeats totalSeats totalLowerSeats totalUpperSeats bookedSeats remainingSeats seatsPerRow lowerSeatsPerRow upperSeatsPerRow tourName perPersonCost");
    return tour;
  }

  async lockSeat(tourId, seatNumber, userId) {
    const seatLockService = require("../services/seatLockService");
    const { emitSeatUpdate } = require("../services/socketService");
    const result = await seatLockService.lockSeat(tourId, seatNumber, userId);
    emitSeatUpdate(tourId, { action: "locked", ...result });
    return result;
  }

  async releaseSeat(tourId, seatNumber, userId) {
    const seatLockService = require("../services/seatLockService");
    const { emitSeatUpdate } = require("../services/socketService");
    const result = await seatLockService.releaseSeat(tourId, seatNumber, userId);
    emitSeatUpdate(tourId, { action: "released", ...result });
    return result;
  }

  async updateTour(id, payload) {
    console.log(payload);
    if (payload.meetingPoint && !Array.isArray(payload.meetingPoint)) {
      payload.meetingPoint = [payload.meetingPoint];
    }

    if (payload.bookedSeats !== undefined) {
      const tour = await this.model.findById(id);
      if (payload.bookedSeats > payload.totalSeats) {
        throw new Error("Booked seats cannot exceed total seats");
      }
    }
    if (payload.bookedSeats !== undefined && payload.totalSeats !== undefined) {
      if (payload.bookedSeats > payload.totalSeats) {
        throw new Error("Booked seats cannot exceed total seats");
      }
    }
    payload.remainingSeats = payload.totalSeats - payload.bookedSeats;
    return this.model.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
  }

  async deleteTour(id) {
    return this.model.findByIdAndDelete(id);
  }
  async toggleDisable(id) {
    const getDisabled = await this.model.findById(id).select("isDisabled");
    const isDisabled = !getDisabled.isDisabled;
    return this.model.findByIdAndUpdate(
      id,
      {
        isDisabled,
      },
      { new: true },
    );
  }
  async updateStatus(id, status) {
    return this.model.findByIdAndUpdate(
      id,
      { status },
      {
        new: true,
        runValidators: true,
      },
    );
  }
}

module.exports = TourController;
