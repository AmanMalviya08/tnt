const mongoose = require("mongoose");
const { userModel } = require("../models/userModel");
const {
    getLoyaltyConfig,
    recordLoyaltyEvent,
    sendMilestoneNotification,
    getRewardHistory,
    REQUIRED_YATRAS,
} = require("../services/loyaltyService");

const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

// ---------------------------------------------------------------------------
// Internal helper — create an in-app notification record for the user
// ---------------------------------------------------------------------------
async function _createNotification(userId, title, message) {
    try {
        const NotificationModel = mongoose.models["Notification"] || null;
        if (NotificationModel) {
            await new NotificationModel({
                userId,
                title,
                message,
                type: "yatra_loyalty",
                isRead: false,
            }).save();
        } else {
            // Fallback: log — notification collection not set up
            console.log(`[YatraLoyalty] Notification for user ${userId}: ${title}`);
        }
    } catch (err) {
        // Non-critical — do not throw
        console.error("[YatraLoyalty] Failed to create notification:", err.message);
    }
}

// ---------------------------------------------------------------------------
// Get the company's current loyalty discount settings
// ---------------------------------------------------------------------------
async function _getLoyaltyConfig() {
    return getLoyaltyConfig();
}

// ---------------------------------------------------------------------------
// Called when a Group Tour booking status changes to "Completed"
// and numberOfTravelers > 1.
//
// ONE-TIME OFFER RULES:
//  - If the user has already claimed the discount → do nothing.
//  - Increments counter on the User document's yatraLoyalty sub-object.
//  - Fires a notification exactly when the 4th completion is hit.
// ---------------------------------------------------------------------------
async function incrementCompletedYatras(userId, bookingId) {
    if (!userId) return null;

    const user = await userModel.findById(userId).select("yatraLoyalty");
    if (!user) return null;

    const loyalty = user.yatraLoyalty || {};

    // One-time only — stop if already claimed
    if (loyalty.discountClaimed) return user;

    // Stop incrementing beyond threshold (user is already eligible)
    if (loyalty.isEligible) return user;

    const currentCount = loyalty.completedGroupYatras || 0;
    const required = loyalty.requiredYatras || REQUIRED_YATRAS;
    const newCount = currentCount + 1;
    const nowEligible = newCount >= required;

    await userModel.findByIdAndUpdate(userId, {
        $set: {
            "yatraLoyalty.completedGroupYatras": newCount,
            "yatraLoyalty.requiredYatras": required,
            "yatraLoyalty.isEligible": nowEligible,
        },
    });

    // Fire notification exactly at the milestone
    if (nowEligible) {
        const config = await _getLoyaltyConfig();
        const discountText =
            config.discountType === "free"
                ? "FREE (100% off)"
                : `₹${config.discountValue} discount`;

        await _createNotification(
            userId,
            "🎉 You've unlocked a Group Yatra Offer!",
            `You have completed ${required} Group Yatras! Your next Group Yatra booking will get a ${discountText}. This is a one-time offer — don't miss it!`
        );

        await recordLoyaltyEvent({
            userId,
            eventType: "milestone_unlocked",
            completedGroupYatras: newCount,
            requiredYatras: required,
            discountType: config.discountType,
            discountValue: config.discountValue,
            bookingId,
            message: `Unlocked reward after ${required} Group Yatras`,
        });

        sendMilestoneNotification(userId, required, config).catch((err) =>
            console.error("[YatraLoyalty] FCM push failed:", err.message)
        );
    } else {
        await recordLoyaltyEvent({
            userId,
            eventType: "progress_increment",
            completedGroupYatras: newCount,
            requiredYatras: required,
            bookingId,
            message: `Completed Group Yatra ${newCount}/${required}`,
        });
    }

    return user;
}

// ---------------------------------------------------------------------------
// Check whether a user is eligible for the one-time loyalty discount.
// Returns discount details if eligible.
// ---------------------------------------------------------------------------
async function checkEligibilityAndGetDiscount(userId) {
    if (!userId) return { isEligible: false };

    const user = await userModel
        .findById(userId)
        .select("yatraLoyalty")
        .lean();

    const loyalty = user?.yatraLoyalty;
    if (!loyalty || !loyalty.isEligible || loyalty.discountClaimed) {
        return { isEligible: false };
    }

    const config = await _getLoyaltyConfig();
    return {
        isEligible: true,
        discountType: config.discountType,
        discountValue: config.discountValue,
    };
}

// ---------------------------------------------------------------------------
// Consume the discount: mark it as claimed on the User document.
// This is permanent — the offer cannot be used again.
// ---------------------------------------------------------------------------
async function consumeDiscount(userId, bookingId, appliedDiscountType, appliedDiscountValue) {
    if (!userId) return null;

    await userModel.findByIdAndUpdate(userId, {
        $set: {
            "yatraLoyalty.discountClaimed": true,
            "yatraLoyalty.claimedAt": new Date(),
            "yatraLoyalty.rewardBookingId": bookingId,
            "yatraLoyalty.appliedDiscountType": appliedDiscountType,
            "yatraLoyalty.appliedDiscountValue": appliedDiscountValue,
        },
    });

    await recordLoyaltyEvent({
        userId,
        eventType: "reward_applied",
        discountType: appliedDiscountType,
        discountValue: appliedDiscountValue,
        bookingId,
        message: `Reward applied: ${appliedDiscountType === "free" ? "Free Group Yatra" : `₹${appliedDiscountValue} off`}`,
    });

    return true;
}

// ---------------------------------------------------------------------------
// User-facing: get current loyalty progress
// ---------------------------------------------------------------------------
async function getLoyaltyStatus(userId) {
    if (!userId) throw new Error("userId is required");

    const user = await userModel.findById(userId).select("yatraLoyalty").lean();
    const loyalty = user?.yatraLoyalty || {};
    const config = await _getLoyaltyConfig();

    const completed = loyalty.completedGroupYatras || 0;
    const required = loyalty.requiredYatras || REQUIRED_YATRAS;

    // Offer already used
    if (loyalty.discountClaimed) {
        return {
            completedGroupYatras: completed,
            requiredYatras: required,
            remaining: 0,
            isEligible: false,
            discountClaimed: true,
            claimedAt: loyalty.claimedAt,
            rewardBookingId: loyalty.rewardBookingId,
            appliedDiscountType: loyalty.appliedDiscountType,
            appliedDiscountValue: loyalty.appliedDiscountValue,
            offerDetails: { discountType: config.discountType, discountValue: config.discountValue },
            message: "You have already used your one-time Group Yatra loyalty discount. Thank you for being a loyal traveler! 🙏",
        };
    }

    // Eligible but not yet claimed
    if (loyalty.isEligible) {
        return {
            completedGroupYatras: completed,
            requiredYatras: required,
            remaining: 0,
            isEligible: true,
            discountClaimed: false,
            offerDetails: { discountType: config.discountType, discountValue: config.discountValue },
            message: "🎉 Congratulations! Your next Group Yatra booking will get a one-time loyalty discount!",
        };
    }

    // Still collecting completions
    const remaining = Math.max(required - completed, 0);
    return {
        completedGroupYatras: completed,
        requiredYatras: required,
        remaining,
        isEligible: false,
        discountClaimed: false,
        offerDetails: { discountType: config.discountType, discountValue: config.discountValue },
        message: `Complete ${remaining} more Group Yatra${remaining !== 1 ? "s" : ""} (with more than 1 traveler) to unlock your one-time discount!`,
    };
}

// ---------------------------------------------------------------------------
// Admin: paginated list of users who have any loyalty activity
// ---------------------------------------------------------------------------
async function getAllLoyaltyRecords(options = {}, filters = {}) {
    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize =
        !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
    const currentPage =
        !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    // Only return users who have started the loyalty journey
    const query = { "yatraLoyalty.completedGroupYatras": { $gt: 0 } };

    if (filters.isEligible !== undefined)
        query["yatraLoyalty.isEligible"] = filters.isEligible === "true";
    if (filters.discountClaimed !== undefined)
        query["yatraLoyalty.discountClaimed"] = filters.discountClaimed === "true";

    const [items, totalItems] = await Promise.all([
        userModel
            .find(query)
            .select("firstName lastName email phone yatraLoyalty")
            .sort({ _id: -1 })
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize)
            .populate("yatraLoyalty.rewardBookingId", "bookingId bookingStatus finalAmount"),
        userModel.countDocuments(query),
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
    incrementCompletedYatras,
    checkEligibilityAndGetDiscount,
    consumeDiscount,
    getLoyaltyStatus,
    getAllLoyaltyRecords,
    getRewardHistory,
};
