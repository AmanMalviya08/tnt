const mongoose = require("mongoose");
const { placeModel } = require("./placeModel");
const { packageModel } = require("./packageModel");
const { tourModel } = require("./tourModel");
const Guide = require("./guideModel");

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    placeId: { type: mongoose.Schema.Types.ObjectId, ref: "Place" },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide" },
    tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour" },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, trim: true },
    location: { type: Number, min: 1, max: 5 },
    price: { type: Number, min: 1, max: 5 },
    services: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true },
);

reviewSchema.pre("save", async function (next) {
  console.log("inside here");
  if (
    (this.isModified("location") ||
      this.isModified("services") ||
      this.isModified("price")) &&
    this.placeId
  ) {
    await updatePlaceAverages(this.placeId);
  }
  if (
    (this.isModified("location") ||
      this.isModified("services") ||
      this.isModified("price")) &&
    this.packageId
  ) {
    await updatePackageAverages(this.packageId);
  }
  if (this.isModified("rating") && this.guideId) {
    await updateGuideAverages(this.guideId);
  }
  if (this.isModified("rating") && this.tourId) {
    await updateTourAverages(this.tourId);
  }
  next();
});

reviewSchema.post("findOneAndUpdate", async function (doc, next) {
  // console.log("sdasdasd")
  if (doc && doc.placeId) {
    await updatePlaceAverages(doc.placeId);
  }
  if (doc && doc.packageId) {
    await updatePackageAverages(doc.packageId);
  }
  if (doc && doc.guideId) {
    console.log("this works", doc.guideId);
    await updateGuideAverages(doc.guideId);
  }
  if (doc && doc.tourId) {
    await updateTourAverages(doc.tourId);
  }
  next();
});
async function updatePlaceAverages(placeId) {
  try {
    const result = await mongoose.model("Review").aggregate([
      { $match: { placeId: new mongoose.Types.ObjectId(placeId) } },
      {
        $group: {
          _id: "$placeId",
          avgRating: {
            $avg: {
              $avg: ["$location", "$price", "$services"],
            },
          },
          avgLocation: { $avg: "$location" },
          avgPrice: { $avg: "$price" },
          avgServices: { $avg: "$services" },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $project: {
          avgRating: { $round: ["$avgRating", 2] },
          avgLocation: { $round: ["$avgLocation", 2] },
          avgPrice: { $round: ["$avgPrice", 2] },
          avgServices: { $round: ["$avgServices", 2] },
          totalReviews: 1,
        },
      },
    ]);

    if (result.length > 0) {
      const { avgRating, totalReviews, avgLocation, avgPrice, avgServices } =
        result[0];
      await placeModel.findByIdAndUpdate(placeId, {
        averageRating: avgRating,
        ratings: {
          location: avgLocation,
          price: avgPrice,
          services: avgServices,
          averageRating: avgRating,
          totalReviews,
        },
        totalReviews,
      });
    }
  } catch (error) {
    console.error("Error updating place averages:", error);
  }
}
async function updateGuideAverages(guideId) {
  try {
    const result = await mongoose.model("Review").aggregate([
      { $match: { guideId: new mongoose.Types.ObjectId(guideId) } },
      {
        $group: {
          _id: "$guideId",
          avgRating: {
            $avg: {
              $avg: ["$rating"],
            },
          },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $project: {
          avgRating: { $round: ["$avgRating", 2] },
          totalReviews: 1,
        },
      },
    ]);

    if (result.length > 0) {
      const { avgRating, totalReviews } = result[0];
      await Guide.findByIdAndUpdate(guideId, {
        ratings: {
          averageRating: avgRating,
          totalReviews,
        },
      });
    }
  } catch (error) {
    console.error("Error updating guide averages:", error);
  }
}
async function updateTourAverages(tourId) {
  try {
    const result = await mongoose.model("Review").aggregate([
      { $match: { tourId: new mongoose.Types.ObjectId(tourId) } },
      {
        $group: {
          _id: "$tourId",
          avgRating: {
            $avg: "$rating",
          },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $project: {
          avgRating: { $round: ["$avgRating", 2] },
          totalReviews: 1,
        },
      },
    ]);

    if (result.length > 0) {
      const { avgRating, totalReviews } = result[0];
      await tourModel.findByIdAndUpdate(tourId, {
        ratings: {
          averageRating: avgRating,
          totalReviews,
        },
      });
    }
  } catch (error) {
    console.error("Error updating tour averages:", error);
  }
}
async function updatePackageAverages(packageId) {
  try {
    const result = await mongoose.model("Review").aggregate([
      { $match: { packageId: new mongoose.Types.ObjectId(packageId) } },
      {
        $group: {
          _id: "$packageId",
          avgRating: {
            $avg: {
              $avg: ["$location", "$price", "$services"],
            },
          },
          avgLocation: { $avg: "$location" },
          avgPrice: { $avg: "$price" },
          avgServices: { $avg: "$services" },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $project: {
          avgRating: { $round: ["$avgRating", 2] },
          avgLocation: { $round: ["$avgLocation", 2] },
          avgPrice: { $round: ["$avgPrice", 2] },
          avgServices: { $round: ["$avgServices", 2] },
          totalReviews: 1,
        },
      },
    ]);

    if (result.length > 0) {
      const { avgRating, totalReviews, avgLocation, avgPrice, avgServices } =
        result[0];
      console.log(totalReviews);
      await packageModel.findByIdAndUpdate(packageId, {
        ratings: {
          location: avgLocation,
          price: avgPrice,
          services: avgServices,
          averageRating: avgRating,
          totalReviews,
        },
      });
    }
  } catch (error) {
    console.error("Error updating place averages:", error);
  }
}
const reviewModel = mongoose.model("Review", reviewSchema);
module.exports = reviewModel;
