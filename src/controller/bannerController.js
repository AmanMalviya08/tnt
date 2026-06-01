const { bannerModel } = require("../models/bannerModel");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);
const mongoose = require('mongoose')
class BannerController {
  constructor(model = bannerModel) {
    this.model = model;
  }

  async addBanner(payload) {
    // console.log("inside add banner")

    const banner = await this.model.create(payload);
    return banner;
  }
  async updateBanner(id, payload) {
    // console.log("inside add banner")
    const updateBanner = await this.model.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      { ...payload },
      { new: true, runValidators: true }
    );
    return updateBanner;
  }

  async getBanner(id) {
    const banner = await this.model.findById(id);
    return banner;
  }

  async getAllBanners(options = {}, filter = {}) {
    const { page = 1, limit = DEFAULT_PAGE_SIZE, type, isDisabled, role } = options;
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
    const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const normalisedFilter = {};
    if (type) normalisedFilter.type = type;
    if (isDisabled !== undefined) normalisedFilter.isDisabled = isDisabled;

    if (role) {
      normalisedFilter.role = role;
    } else {
      normalisedFilter.role = "All";
    }
    console.log(normalisedFilter)
    // const banners = await this.model
    //     .find(normalisedFilter)
    //     .skip((currentPage - 1) * pageSize)
    //     .limit(parseInt(pageSize))
    //     .sort({ createdAt: -1 }).populate("offerId");
    // console.log(normalisedFilter)

    const banners = await this.model.aggregate([
      { $match: normalisedFilter },

      {
        $group: {
          _id: "$type",
          banners: { $push: "$$ROOT" }
        }
      },
      {
        $sort: {
          _id: 1
        }
      },

      {
        $set: {
          banners: {
            $slice: [
              { $sortArray: { input: "$banners", sortBy: { displayOrder: 1 } } },
              5
            ]
          }
        }
      }
    ]);





    const totalItems = await this.model.countDocuments(normalisedFilter);
    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);



    return {
      data: banners,
      pagination: {

        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      }
    };
  }
  async deleteBanner(id) {
    return this.model.deleteOne({ _id: id })
  }
}

module.exports = BannerController;