const mongoose = require("mongoose");
const { placeModel } = require("../models/placeModel");

const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

class CityController {
  constructor(cityModel) {
    this.cityModel = cityModel;
  }

  async createCity(data) {
    const city = new this.cityModel(data);
    return city.save();
  }

  async getCities(filter = {}, options = {}) {
    const normalizedFilter = { ...filter };

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "stateId")) {
      const value = normalizedFilter.stateId;
      if (value && mongoose.Types.ObjectId.isValid(value)) {
        normalizedFilter.stateId = new mongoose.Types.ObjectId(value);
      } else {
        delete normalizedFilter.stateId;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "countryId")) {
      const value = normalizedFilter.countryId;
      if (value && mongoose.Types.ObjectId.isValid(value)) {
        normalizedFilter.countryId = new mongoose.Types.ObjectId(value);
      } else {
        delete normalizedFilter.countryId;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "search")) {
      const value = normalizedFilter.search;
      if (value && value.trim()) {
        normalizedFilter.cityName = { $regex: value.trim(), $options: "i" };
      }
      delete normalizedFilter.search;
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
        normalizedFilter.isDisabled = false;
      }
    }

    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
    const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;


    let sort = options.sort || options.sortBy;
    if (typeof sort === "string" && sort.trim()) {
      const order = options.sortOrder || options.order;
      const direction = typeof order === "string" && order.toLowerCase() === "desc" ? -1 : 1;
      sort = { [sort]: direction };
    }

    if (!sort) {
      sort = { cityName: 1 };
    }
    console.log(sort)
    console.log(normalizedFilter)
    const query = this.cityModel.aggregate([
      { $match: normalizedFilter },

      {
        $lookup: {
          from: "states",
          localField: "stateId",
          foreignField: "_id",
          as: "stateId"
        }
      },
      { $unwind: { path: "$stateId", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "contries",
          localField: 'countryId',
          foreignField: "_id",
          as: "countryId"
        }
      },
      { $unwind: { path: "$countryId", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "places",
          localField: "_id",
          foreignField: "cityId",
          as: "places"
        }
      },
      {
        $addFields: {
          placeCount: { $size: "$places" }
        }
      },

      {
        $project: {
          places: 0
        }
      },
      {
        $sort: sort
      },
      { $skip: (currentPage - 1) * pageSize },
      { $limit: pageSize }
    ]);


    // query.sort(sort);
    // query.skip((currentPage - 1) * pageSize).limit(pageSize);

    const [items, totalItems] = await Promise.all([
      query.exec(),
      this.cityModel.countDocuments(normalizedFilter),
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

  async getCityById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const city = await this.cityModel
      .findById(id)
      .populate("stateId")
      .populate("countryId")
      .lean();

    if (!city) {
      return null;
    }

    const placeCount = await placeModel.countDocuments({ cityId: city._id });

    return {
      ...city,
      placeCount,
    };
  }

  async updateCity(id, data) {
    return this.cityModel.findOneAndUpdate({ _id: id }, data, { new: true, runValidators: true });
  }

  async setCityDisabled(id, options = {}) {
    const existing = await this.cityModel.findById(id).select("isDisabled");
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

    return this.cityModel
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
        }
      )
      .populate("stateId")
      .populate("countryId");
  }
  async deleteCity(id) {
    return this.cityModel.deleteOne({ _id: id })

  }
}

module.exports = CityController;
