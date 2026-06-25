const cron = require("node-cron");
const { packageModel } = require("../models/packageModel");
const { bookingModel } = require("../models/bookingModel");

const POPULAR_THRESHOLD = 50;
const POPULAR_PERCENTILE = 0.15;

async function calculatePopularPackages() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const bookingCounts = await bookingModel.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        bookingStatus: { $in: ["Confirmed", "Completed"] },
        selectedPackageId: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$selectedPackageId",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const countMap = new Map(
    bookingCounts.map((b) => [String(b._id), b.count])
  );

  const sortedCounts = bookingCounts.map((b) => b.count);
  const top15Index = Math.max(
    Math.ceil(sortedCounts.length * POPULAR_PERCENTILE) - 1,
    0
  );
  const percentileThreshold =
    sortedCounts.length > 0 ? sortedCounts[top15Index] || 0 : POPULAR_THRESHOLD;

  const effectiveThreshold = Math.max(percentileThreshold, POPULAR_THRESHOLD);

  const packages = await packageModel.find({ isDisabled: false }).select("_id");

  const bulkOps = packages.map((pkg) => {
    const count = countMap.get(String(pkg._id)) || 0;
    const isPopular = count >= effectiveThreshold;
    return {
      updateOne: {
        filter: { _id: pkg._id },
        update: {
          $set: {
            bookingCountLast30Days: count,
            isPopular,
          },
        },
      },
    };
  });

  if (bulkOps.length) {
    await packageModel.bulkWrite(bulkOps);
  }

  console.log(
    `[PopularPackages] Updated ${bulkOps.length} packages. Threshold: ${effectiveThreshold}`
  );

  return { updated: bulkOps.length, threshold: effectiveThreshold };
}

function initPopularPackagesScheduler() {
  cron.schedule("0 2 * * *", () => {
    calculatePopularPackages().catch((err) =>
      console.error("[PopularPackages] Scheduler error:", err.message)
    );
  });

  calculatePopularPackages().catch((err) =>
    console.error("[PopularPackages] Initial run error:", err.message)
  );

  console.log("[PopularPackages] Daily scheduler initialized");
}

module.exports = {
  calculatePopularPackages,
  initPopularPackagesScheduler,
};
