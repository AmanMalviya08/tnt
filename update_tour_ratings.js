const mongoose = require("mongoose");
const { tourModel } = require("../src/models/tourModel");
const reviewModel = require("../src/models/reviewModel");

async function updateAllTourRatings() {
  try {
    // Connect to DB if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/yourdb");
    }

    const tours = await tourModel.find({});
    console.log(`Found ${tours.length} tours`);

    for (const tour of tours) {
      const result = await reviewModel.aggregate([
        { $match: { tourId: tour._id } },
        {
          $group: {
            _id: "$tourId",
            avgRating: { $avg: "$rating" },
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
        await tourModel.findByIdAndUpdate(tour._id, {
          ratings: {
            averageRating: avgRating,
            totalReviews,
          },
        });
        console.log(`Updated tour ${tour._id}: rating ${avgRating}, reviews ${totalReviews}`);
      } else {
        // No reviews, set to 0
        await tourModel.findByIdAndUpdate(tour._id, {
          ratings: {
            averageRating: 0,
            totalReviews: 0,
          },
        });
        console.log(`Updated tour ${tour._id}: no reviews`);
      }
    }

    console.log("All tours updated");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

updateAllTourRatings();