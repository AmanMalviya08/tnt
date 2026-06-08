const mongoose = require("mongoose");

const guideWalletSchema = new mongoose.Schema(
  {
    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    totalWithdrawals: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const guideWalletModel = mongoose.model("GuideWallet", guideWalletSchema);

module.exports = { guideWalletModel };
