const mongoose = require("mongoose");

const freePackageRewardSchema = new mongoose.Schema(
    {
        agentUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        confirmedBookingsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        requiredBookings: {
            type: Number,
            default: 20,
            min: 1,
        },
        isEligible: {
            type: Boolean,
            default: false,
        },
        isClaimed: {
            type: Boolean,
            default: false,
        },
        claimedAt: {
            type: Date,
        },
        rewardBookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
        },
        rewardPackageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Package",
        },
        cycleNumber: {
            type: Number,
            default: 1,
            min: 1,
        },
        isDisabled: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Compound index to quickly find the active (unclaimed) cycle for an agent
freePackageRewardSchema.index({ agentUserId: 1, isClaimed: 1 });

const FreePackageReward = mongoose.model(
    "FreePackageReward",
    freePackageRewardSchema
);

module.exports = FreePackageReward;
