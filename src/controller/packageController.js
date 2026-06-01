const { default: mongoose } = require("mongoose");
const { packageModel } = require("../models/packageModel");

const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

class PackageController {
  constructor(model = packageModel) {
    this.model = model;
  }

  async createPackage(payload) {
    const travelPackage = new this.model(payload);
    return travelPackage.save();
  }

  async getPackages(filter = {}, options = {}) {
    const normalizedFilter = { ...filter };

    let userId = undefined;
    let countryId = undefined;

    if (normalizedFilter.duration) {
      const value = normalizedFilter.duration.toString();

      if (value.includes("-")) {
        const [minDuration, maxDuration] = value.split("-").map(Number);

        normalizedFilter.minDuration = minDuration;
        normalizedFilter.maxDuration = maxDuration;

        delete normalizedFilter.duration;
      } else {
        delete normalizedFilter.minDuration;
        delete normalizedFilter.maxDuration;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "userId")) {
      const value = normalizedFilter.userId;

      if (value && mongoose.Types.ObjectId.isValid(value)) {
        userId = new mongoose.Types.ObjectId(value);
      }
      delete normalizedFilter.userId;
    }
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "duration")) {
      if (
        normalizedFilter.duration &&
        normalizedFilter.duration.trim() &&
        !isNaN(Number(normalizedFilter.duration.trim()))
      ) {
        const value = normalizedFilter.duration.trim();
        if (value) {
          const duration = Math.max(Number(value), 1);
          normalizedFilter.durationDays = { $gte: duration, $lt: duration + 1 };
        }
      }
      delete normalizedFilter.duration;
    }
    if (
      Object.prototype.hasOwnProperty.call(normalizedFilter, "minDuration") &&
      Object.prototype.hasOwnProperty.call(normalizedFilter, "maxDuration")
    ) {
      if (
        normalizedFilter.minDuration &&
        normalizedFilter.maxDuration &&
        normalizedFilter.minDuration.trim() &&
        normalizedFilter.maxDuration.trim() &&
        !isNaN(Number(normalizedFilter.minDuration.trim())) &&
        !isNaN(Number(normalizedFilter.maxDuration.trim()))
      ) {
        const minValue = normalizedFilter.minDuration.trim();
        const maxValue = normalizedFilter.maxDuration.trim();
        const minDuration = Math.max(Number(minValue), 1);
        const maxDuration = Math.max(Number(maxValue), 1);
        normalizedFilter.durationDays = {
          $gte: minDuration,
          $lt: maxDuration + 1,
        };
      }
      delete normalizedFilter.minDuration;
      delete normalizedFilter.maxDuration;
    }
    // In src/controller/packageController.js

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "rating")) {
      const val = normalizedFilter.rating;
      if (val !== undefined && val !== null && val !== '') {
        const rating = parseFloat(val);
        if (!isNaN(rating) && rating > 0) {
          normalizedFilter["ratings.averageRating"] = { 
            $gte: rating,
            $gt: 0,          // Explicitly exclude 0
            $type: "number"  // Explicitly ensure it's a number
          };
        }
      }
      delete normalizedFilter.rating;
    }

    // console.log(normalizedFilter)
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "cityId")) {
      const value = normalizedFilter.cityId;

      if (value && typeof value === 'string') {
        // Handle comma-separated cityIds
        if (value.includes(',')) {
          const cityIds = value.split(',')
            .map(id => id.trim())
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
          if (cityIds.length > 0) {
            normalizedFilter.cityIds = { $in: cityIds };
          }
        } else if (mongoose.Types.ObjectId.isValid(value)) {
          normalizedFilter.cityIds = {
            $in: [new mongoose.Types.ObjectId(value)],
          };
        }
        delete normalizedFilter.cityId;
      }
    }
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "countryId")) {
      const value = normalizedFilter.countryId;
      console.log(value)
      if (value && mongoose.Types.ObjectId.isValid(value)) {
        countryId = new mongoose.Types.ObjectId(value);
      }

      delete normalizedFilter.countryId;
    }
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "isDisabled")) {
      const raw = normalizedFilter.isDisabled;
      if (typeof raw === "string") {
        normalizedFilter.isDisabled = raw === "true";
      } else {
        normalizedFilter.isDisabled = Boolean(raw);
      }
    } else {
      const includeDisabled =
        typeof options.includeDisabled === "string"
          ? options.includeDisabled === "true"
          : Boolean(options.includeDisabled);
      if (!includeDisabled) {
        // normalizedFilter.isDisabled = false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "search")) {
      const value = normalizedFilter.search;
      if (value && value.trim()) {
        const regex = { $regex: value.trim(), $options: "i" };
        normalizedFilter.$or = [
          { packageName: regex },
          { tagline: regex },
          { slug: regex },
        ];
      }
      delete normalizedFilter.search;
    }
    let priceFilter = undefined;
    if (
      Object.prototype.hasOwnProperty.call(normalizedFilter, "min") &&
      Object.prototype.hasOwnProperty.call(normalizedFilter, "max")
    ) {
      const minValue = parseFloat(normalizedFilter.min.trim());
      const maxValue = parseFloat(normalizedFilter.max.trim());

      if (minValue && maxValue) {
        priceFilter = {
          $match: {
            basePricePerPerson: {
              $gte: minValue,
              $lte: maxValue,
            },
          },
        };
      }

      delete normalizedFilter.min;
      delete normalizedFilter.max;
    }

    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize =
      !Number.isNaN(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : DEFAULT_PAGE_SIZE;
    const currentPage =
      !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    // const query = this.model.find(normalizedFilter).populate("cityIds").populate("itinerary.placeIds");

    let sort = options.sort || options.sortBy;
    if (typeof sort === "string" && sort.trim()) {
      const order = options.sortOrder || options.order;
      const direction =
        typeof order === "string" && order.toLowerCase() === "desc" ? -1 : 1;
      sort = { [sort]: direction };
    }

    if (!sort) {
      sort = { createdAt: -1 };
    }

    // query.sort(sort);
    // query.skip((currentPage - 1) * pageSize).limit(pageSize);
    // console.log(sort)
    // console.log(userId)
    const query = this.model.aggregate([
      { $match: normalizedFilter },
      {
        $lookup: {
          from: "cities",
          localField: "cityIds",
          foreignField: "_id",
          as: "cities",
        },
      },
      ...(countryId
        ? [
          {
            $match: {
              "cities.countryId": countryId,
            },
          },
        ]
        : []),
      {
        $addFields: {
          originalDoc: "$$ROOT",
        },
      },
      {
        $unwind: {
          path: "$itinerary",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "places",
          localField: "itinerary.placeIds",
          foreignField: "_id",
          as: "itinerary.placeIds",
        },
      },
      {
        $group: {
          _id: "$_id",
          originalDoc: {
            $first: "$originalDoc",
          },
          itinerary: { $push: "$itinerary" },
        },
      },
      {
        $addFields: {
          "originalDoc.itinerary": "$itinerary",
        },
      },

      {
        $replaceRoot: {
          newRoot: "$originalDoc",
        },
      },
      ...(priceFilter ? [priceFilter] : []),

      ...(userId
        ? [
          {
            $lookup: {
              from: "wishlists",
              let: { packageId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $in: [
                            "$$packageId",
                            { $ifNull: ["$packageId", []] },
                          ],
                        },
                        { $eq: ["$userId", userId] },
                      ],
                    },
                  },
                },
              ],
              as: "wishlistData",
            },
          },
          {
            $addFields: {
              isWishlist: { $gt: [{ $size: "$wishlistData" }, 0] },
            },
          },
          {
            $project: {
              wishlistData: 0,
            },
          },
        ]
        : []),
      {
        $sort: sort,
      },
      { $skip: (currentPage - 1) * pageSize },
      { $limit: pageSize },
    ]);
    const [items, totalItems] = await Promise.all([
      query.exec(),
      this.model.countDocuments(normalizedFilter),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: items,
      pagination: {
        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async getPackageById(id) {
    return this.model
      .findById(id)
      .populate("cityIds")
      .populate("itinerary.placeIds");
  }

  async updatePackage(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
  }
  async deletePackage(id) {
    return this.model.deleteOne({ _id: id });
  }

  async setPackageDisabled(id, options = {}) {
    const existing = await this.model.findById(id).select("isDisabled");
    if (!existing) {
      return null;
    }

    let { isDisabled } = options;

    if (typeof isDisabled === "string") {
      isDisabled = isDisabled === "true";
    }

    if (typeof isDisabled === "undefined") {
      isDisabled = !existing.isDisabled;
    } else {
      isDisabled = Boolean(isDisabled);
    }

    return this.model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            isDisabled,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .populate("cityIds");
  }

  async duplicatePackage(id) {
    const existing = await this.getPackageById(id);
    if (!existing) {
      return null;
    }

    const duplicate = existing.toObject();
    delete duplicate._id;
    delete duplicate.slug;
    duplicate.packageName = `${duplicate.packageName} (Copy)`;
    duplicate.createdAt = undefined;
    duplicate.updatedAt = undefined;
    duplicate.totalBookings = 0;

    const travelPackage = new this.model(duplicate);

    return travelPackage.save();
  }
}

module.exports = PackageController;
