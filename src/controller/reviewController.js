const { default: mongoose } = require("mongoose");
const { reviewModel } = require("../models/reviewModel");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);
const DEFAULT_TESTIMONIALS_PAGE_SIZE = parseInt(
  process.env.DEFAULT_TESTIMONIALS_PAGE_SIZE || "5",
  5,
);
const { placeModel } = require("../models/placeModel");
class ReviewController {
  constructor(model = reviewModel) {
    this.model = model;
  }

  async addReview(payload) {
    const { userId, review, placeId, packageId, guideId, tourId, bookingId } =
      payload;
    let { rating = "1", location = "1", price = "1", services = "1" } = payload;

    if (rating && rating.trim()) {
      rating = Math.min(Math.max(Number(rating), 1), 5);
    }
    if (location && location.trim()) {
      location = Math.min(Math.max(Number(location), 1), 5);
    }
    if (price && price.trim()) {
      price = Math.min(Math.max(Number(price), 1), 5);
    }
    if (services && services.trim()) {
      services = Math.min(Math.max(Number(services), 1), 5);
    }
    const findOneData = {};
    findOneData.userId = userId;

    if (tourId) {
      findOneData.tourId = tourId;
    }

    if (placeId) {
      findOneData.placeId = placeId;
    }
    if (packageId) {
      findOneData.packageId = packageId;
    }
    if (guideId) {
      findOneData.guideId = guideId;
    }
    if (bookingId) {
      findOneData.bookingId = bookingId;
    }
    const checkDocument = await this.model.findOne(findOneData);

    if (!checkDocument) {
      let ReviewNewDocument = await this.model.create({
        userId,
        tourId,
        placeId,
        packageId,
        guideId,
        bookingId,
        rating,
        review,
        price,
        location,
        services,
      });
      return ReviewNewDocument;
    }

    let wishlistDocument = await this.model.findOneAndUpdate(
      findOneData,
      {
        placeId,
        packageId,
        guideId,
        tourId,
        bookingId,
        rating,
        review,
        price,
        location,
        services,
      },

      { new: true, runValidators: true },
    );

    return wishlistDocument;
  }

  async getReview(options = {}, filters = {}) {
    const normalizedFilter = {};
    const averagePlaceFilter = {};
    const averagePackageFilter = {};

    if (filters.placeId && filters.placeId.trim()) {
      const value = filters.placeId.trim();
      if (mongoose.Types.ObjectId.isValid(value)) {
        normalizedFilter.placeId = value;
        averagePlaceFilter._id = new mongoose.Types.ObjectId(value);
      }
    }

    if (filters.packageId && filters.packageId.trim()) {
      const value = filters.packageId.trim();
      if (mongoose.Types.ObjectId.isValid(value)) {
        normalizedFilter.packageId = value;
        averagePackageFilter._id = new mongoose.Types.ObjectId(value);
      }
    }
    if (filters.guideId && filters.guideId.trim()) {
      const value = filters.guideId.trim();
      if (mongoose.Types.ObjectId.isValid(value)) {
        normalizedFilter.guideId = value;
      }
    }
    if (filters.userId && filters.userId.trim()) {
      const value = filters.userId.trim();
      if (mongoose.Types.ObjectId.isValid(value)) {
        normalizedFilter.userId = value;
      }
    }
    if (
      filters.rating &&
      filters.rating.trim() &&
      !isNaN(Number(filters.rating.trim()))
    ) {
      const value = filters.rating.trim();
      if (value) {
        const rating = Math.min(Math.max(Number(value), 1), 5);
        normalizedFilter.rating = { $gte: rating, $lt: rating + 1 };
      }
    }

    if (filters.tourId && filters.tourId.trim()) {
      const value = filters.tourId.trim();
      if (mongoose.Types.ObjectId.isValid(value)) {
        normalizedFilter.tourId = value;
      }
    }

    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize =
      !Number.isNaN(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : DEFAULT_PAGE_SIZE;
    const currentPage =
      !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const query = this.model
      .find(normalizedFilter)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .populate("placeId userId packageId tourId")
      .lean();

    // const averagesAgg = this.model.aggregate([
    //     {
    //         $match: aggregateFilter
    //     },
    //     {
    //         $group: {
    //             _id: null,
    //             avgRating: {
    //                 $avg: {
    //                     $avg: ["$location", "$price", "$services"]
    //                 }
    //             },

    //             avgLocation: { $avg: "$location" },
    //             avgPrice: { $avg: "$price" },
    //             avgServices: { $avg: "$services" },
    //             totalReviews: { $sum: 1 }
    //         }
    //     },
    //     {
    //         $project: {
    //             _id: 0,
    //             avgRating: { $round: ["$avgRating", 2] },
    //             avgLocation: { $round: ["$avgLocation", 2] },
    //             avgPrice: { $round: ["$avgPrice", 2] },
    //             avgServices: { $round: ["$avgServices", 2] },
    //             totalReviews: { $round: ["$totalReviews", 2] }

    //         }
    //     }
    // ])
    const averagesAgg = placeModel.aggregate([
      { $match: averagePlaceFilter },
      {
        $project: {
          ratings: {
            avgRating: "$ratings.averageRating",
            avgLocation: "$ratings.location",
            avgPrice: "$ratings.price",
            avgServices: "$ratings.services",
            totalReview: "$ratings.totalReviews",
          },
          _id: 0,
        },
      },
    ]);

    const [items, totalItems, averages] = await Promise.all([
      query.exec(),
      this.model.countDocuments(normalizedFilter),
      averagesAgg.exec(),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);
    let ratings = {
      avgRating: 1,
      avgLocation: 1,
      avgPrice: 1,
      avgServices: 1,
      totalReview: 1,
    };

    if (normalizedFilter.placeId) {
      ratings = {
        avgRating: items[0]?.placeId?.ratings?.averageRating || 1,
        avgLocation: items[0]?.placeId?.ratings?.location || 1,
        avgPrice: items[0]?.placeId?.ratings?.price || 1,
        avgServices: items[0]?.placeId?.ratings?.services || 1,
        totalReview: items[0]?.placeId?.ratings?.totalReviews || 1,
      };
    } else if (normalizedFilter.packageId) {
      ratings = {
        avgRating: items[0]?.packageId?.ratings?.averageRating || 1,
        avgLocation: items[0]?.packageId?.ratings?.location || 1,
        avgPrice: items[0]?.packageId?.ratings?.price || 1,
        avgServices: items[0]?.packageId?.ratings?.services || 1,
        totalReview: items[0]?.packageId?.ratings?.totalReviews || 1,
      };
    } else if (normalizedFilter.tourId) {
      ratings = {
        avgRating: items[0]?.tourId?.ratings?.averageRating || 1,
        avgLocation: items[0]?.tourId?.ratings?.location || 1,
        avgPrice: items[0]?.tourId?.ratings?.price || 1,
        avgServices: items[0]?.tourId?.ratings?.services || 1,
        totalReview: items[0]?.tourId?.ratings?.totalReviews || 1,
      };
    }

    return {
      data: items,
      ratings,
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

  async deleteReviewById(userId, placeId) {
    await this.model.deleteOne({
      userId,
      placeId,
    });
    const result = await this.model.aggregate([
      { $match: { placeId: new mongoose.Types.ObjectId(placeId) } },
      {
        $group: {
          _id: "$placeId",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    // console.log(result)
    if (result.length > 0) {
      const { averageRating, totalReviews } = result[0];

      await placeModel.findByIdAndUpdate(placeId, {
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews,
      });
    }
  }
  async getDistinctTopReviews(limit) {
    const parsedLimit = parseInt(limit, 10);
    const parsedPage =
      !Number.isNaN(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : DEFAULT_TESTIMONIALS_PAGE_SIZE;
    const testimonials = await this.model.aggregate([
      {
        $addFields: {
          avgRating: {
            $avg: [
              { $ifNull: ["$location", 1] },
              { $ifNull: ["$price", 1] },
              { $ifNull: ["$services", 1] },
            ],
          },
        },
      },
      {
        $sort: {
          avgRating: -1,
        },
      },
      {
        $group: {
          _id: "$packageId",
          topReview: {
            $first: "$$ROOT",
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: "$topReview",
        },
      },
      {
        $lookup: {
          from: "packages",
          localField: "packageId",
          foreignField: "_id",
          as: "package",
        },
      },
      {
        $unwind: {
          path: "$package",
          // preserveNullAndEmptyArrays:true
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          // preserveNullAndEmptyArrays:true
        },
      },
      {
        $sort: {
          avgRating: -1,
        },
      },

      { $limit: parsedPage },
      {
        $project: {
          "package.packageName": 1,
          "package._id": 1,
          "user._id": 1,
          "user.firstName": 1,
          "user.lastName": 1,
          "user.avatarUrl": 1,
          "user.bio": 1,
          price: 1,
          location: 1,
          avgRating: 1,
          services: 1,
          review: 1,
        },
      },
    ]);
    return testimonials;
  }
}
module.exports = ReviewController;
