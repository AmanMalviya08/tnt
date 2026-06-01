const FreePackageReward = require("../models/freePackageRewardModel");
const { bookingModel } = require("../models/bookingModel");
const { packageModel } = require("../models/packageModel");
const { agentModel } = require("../models/agentModel");
const { userModel } = require("../models/userModel");
const mongoose = require("mongoose");

const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);
const REQUIRED_BOOKINGS = 5;

/**
 * Called after payment confirmation for each booking that has an assignedAgent.
 * Increments the agent's confirmed booking count in the current (unclaimed) cycle.
 * If count reaches the threshold, marks the cycle as eligible.
 */
async function incrementBookingCount(agentUserId, session) {
    if (!agentUserId) return null;

    // Check if the agent has already claimed a reward in ANY cycle
    const hasClaimed = await FreePackageReward.findOne({
        agentUserId,
        isClaimed: true,
    }).session(session);

    if (hasClaimed) {
        console.log(`Agent ${agentUserId} has already claimed their one-time free package.`);
        return null;
    }

    // Find the current active (unclaimed) cycle for this agent
    let reward = await FreePackageReward.findOne({
        agentUserId,
        isClaimed: false,
    }).session(session);

    // If no active cycle exists, create one
    if (!reward) {
        reward = new FreePackageReward({
            agentUserId,
            confirmedBookingsCount: 0,
            requiredBookings: REQUIRED_BOOKINGS,
            cycleNumber: 1, // Always cycle 1 as it's one-time now
        });
    }

    reward.confirmedBookingsCount += 1;

    if (reward.confirmedBookingsCount >= reward.requiredBookings) {
        reward.isEligible = true;
    }

    await reward.save({ session });
    return reward;
}

/**
 * Get the current reward status for an agent.
 */
async function getRewardStatus(agentUserId) {
    if (!agentUserId) {
        throw new Error("Agent user ID is required");
    }

    // Verify the user is actually an agent
    const agent = await agentModel.findOne({ userId: agentUserId });
    if (!agent) {
        throw new Error("Agent not found");
    }

    // Check if the agent has already claimed a reward
    const claimedReward = await FreePackageReward.findOne({
        agentUserId,
        isClaimed: true,
    });

    if (claimedReward) {
        return {
            confirmedBookingsCount: claimedReward.confirmedBookingsCount,
            requiredBookings: claimedReward.requiredBookings,
            remaining: 0,
            isEligible: true,
            isClaimed: true,
            cycleNumber: 1,
            claimedAt: claimedReward.claimedAt,
            message: "One-time free package reward has already been claimed.",
        };
    }

    // Find the current active (unclaimed) cycle
    let reward = await FreePackageReward.findOne({
        agentUserId,
        isClaimed: false,
    });

    if (!reward) {
        return {
            confirmedBookingsCount: 0,
            requiredBookings: REQUIRED_BOOKINGS,
            remaining: REQUIRED_BOOKINGS,
            isEligible: false,
            isClaimed: false,
            cycleNumber: 1,
        };
    }

    return {
        confirmedBookingsCount: reward.confirmedBookingsCount,
        requiredBookings: reward.requiredBookings,
        remaining: Math.max(
            reward.requiredBookings - reward.confirmedBookingsCount,
            0
        ),
        isEligible: reward.isEligible,
        isClaimed: reward.isClaimed,
        cycleNumber: reward.cycleNumber,
    };
}

/**
 * Agent claims the free package reward.
 * Validates eligibility, creates a ₹0 booking, marks reward as claimed.
 */
async function claimFreePackage(agentUserId, packageId) {
    if (!agentUserId) {
        throw new Error("Agent user ID is required");
    }
    if (!packageId) {
        throw new Error("Package ID is required");
    }

    // Validate agent exists
    const agent = await agentModel.findOne({ userId: agentUserId });
    if (!agent) {
        throw new Error("Agent not found");
    }

    // Validate the user
    const user = await userModel.findById(agentUserId);
    if (!user || user.isDisabled) {
        throw new Error("User account not found or is disabled");
    }

    // Validate the package
    const pkg = await packageModel.findById(packageId);
    if (!pkg) {
        throw new Error("Package not found");
    }
    if (pkg.isDisabled || pkg.status === "Inactive") {
        throw new Error("Package is not available");
    }

    // Check if the agent has already claimed a reward
    const alreadyClaimed = await FreePackageReward.findOne({
        agentUserId,
        isClaimed: true,
    });

    if (alreadyClaimed) {
        throw new Error("You have already claimed your one-time free package reward.");
    }

    // Find the active unclaimed cycle
    console.log(agentUserId)
    const reward = await FreePackageReward.findOne({
        agentUserId,
        isClaimed: false,
    });

    if (!reward) {
        throw new Error(
            "No active reward cycle found. Complete 20 confirmed bookings to earn a free package."
        );
    }

    if (!reward.isEligible) {
        throw new Error(
            `You need ${reward.requiredBookings - reward.confirmedBookingsCount} more confirmed bookings to be eligible for a free package.`
        );
    }

    if (reward.isClaimed) {
        throw new Error("Reward has already been claimed for this cycle.");
    }

    // Create free booking using a session for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const freeBooking = new bookingModel({
            userId: agentUserId,
            customerName: agent.firstName + " " + (agent.lastName || ""),
            mobileNumber: agent.phone || user.phone || "",
            email: agent.email || user.email || "",
            userType: "App User",
            bookingType: "Package Tour",
            selectedPackageId: pkg._id,
            numberOfTravelers: 1,
            adults: 1,
            children: 0,
            packageCostPerPerson: 0,
            childCostPerPerson: 0,
            totalAmount: 0,
            discountAmount: 0,
            finalAmount: 0,
            taxPercent: 0,
            taxAmount: 0,
            paymentStatus: "Paid",
            bookingStatus: "Confirmed",
            paymentMethod: "Wallet",
            assignedAgent: agentUserId,
            notes: `Free package reward - Cycle #${reward.cycleNumber} (after ${reward.requiredBookings} confirmed bookings)`,
            createdBy: agentUserId,
        });

        await freeBooking.save({ session });

        // Mark reward as claimed
        reward.isClaimed = true;
        reward.claimedAt = new Date();
        reward.rewardBookingId = freeBooking._id;
        reward.rewardPackageId = pkg._id;
        await reward.save({ session });

        await session.commitTransaction();
        session.endSession();

        return {
            reward,
            booking: freeBooking,
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
}

/**
 * Get reward history for an agent (all past claimed rewards).
 */
async function getRewardHistory(agentUserId) {
    if (!agentUserId) {
        throw new Error("Agent user ID is required");
    }

    const rewards = await FreePackageReward.find({
        agentUserId,
        isClaimed: true,
    })
        .populate("rewardPackageId", "packageName basePricePerPerson coverImage")
        .populate("rewardBookingId", "bookingId bookingStatus")
        .sort({ cycleNumber: -1 });

    return rewards;
}

/**
 * Admin: get all rewards with pagination.
 */
async function getAllRewards(options = {}, filters = {}) {
    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize =
        !Number.isNaN(parsedLimit) && parsedLimit > 0
            ? parsedLimit
            : DEFAULT_PAGE_SIZE;
    const currentPage =
        !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const searchQuery = {};

    if (filters.agentUserId) {
        searchQuery.agentUserId = filters.agentUserId;
    }
    if (filters.isClaimed !== undefined) {
        searchQuery.isClaimed = filters.isClaimed === "true";
    }
    if (filters.isEligible !== undefined) {
        searchQuery.isEligible = filters.isEligible === "true";
    }

    const query = FreePackageReward.find(searchQuery)
        .populate("agentUserId", "firstName lastName email phone")
        .populate("rewardPackageId", "packageName basePricePerPerson")
        .populate("rewardBookingId", "bookingId bookingStatus")
        .sort({ _id: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize);

    const [items, totalItems] = await Promise.all([
        query.exec(),
        FreePackageReward.countDocuments(searchQuery),
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

module.exports = {
    incrementBookingCount,
    getRewardStatus,
    claimFreePackage,
    getRewardHistory,
    getAllRewards,
};
