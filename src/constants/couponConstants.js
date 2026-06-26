const REWARD_TYPES = ["PHYSICAL_GIFT", "DISCOUNT_PERCENT", "CASHBACK"];

/** Default reward pool — weights are relative probabilities */
const DEFAULT_REWARD_POOL = [
  { rewardType: "PHYSICAL_GIFT", rewardLabel: "Water Bottle", rewardValue: 0, weight: 18 },
  { rewardType: "PHYSICAL_GIFT", rewardLabel: "Pocket Arm Bag", rewardValue: 0, weight: 15 },
  { rewardType: "PHYSICAL_GIFT", rewardLabel: "Free Prasad Box", rewardValue: 0, weight: 12 },
  { rewardType: "PHYSICAL_GIFT", rewardLabel: "Temple Souvenir", rewardValue: 0, weight: 8 },
  { rewardType: "PHYSICAL_GIFT", rewardLabel: "Travel Kit", rewardValue: 0, weight: 6 },
  { rewardType: "DISCOUNT_PERCENT", rewardLabel: "5% off next trip", rewardValue: 5, weight: 35 },
  { rewardType: "DISCOUNT_PERCENT", rewardLabel: "10% off next trip", rewardValue: 10, weight: 20 },
  { rewardType: "CASHBACK", rewardLabel: "₹50 wallet cashback", rewardValue: 50, weight: 12 },
];

const COUPON_EXPIRY_DAYS = parseInt(process.env.SCRATCH_COUPON_EXPIRY_DAYS || "90", 10);

module.exports = {
  REWARD_TYPES,
  DEFAULT_REWARD_POOL,
  COUPON_EXPIRY_DAYS,
};
