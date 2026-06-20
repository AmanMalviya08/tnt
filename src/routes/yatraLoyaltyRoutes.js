const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
    getLoyaltyStatus,
    checkEligibilityAndGetDiscount,
    getAllLoyaltyRecords,
    getRewardHistory,
} = require("../controller/yatraLoyaltyController");

const router = express.Router();

/**
 * GET /api/yatra-loyalty/status
 * User checks their Group Yatra loyalty progress.
 */
router.get("/status", protect, async (req, res) => {
    try {
        const status = await getLoyaltyStatus(req.user.userId);
        res.status(200).json({
            success: true,
            data: status,
            message: "Yatra loyalty status fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/yatra-loyalty/check-discount
 * Returns discount details if the user is eligible for a discount
 * on their next Group Tour booking.
 */
router.get("/check-discount", protect, async (req, res) => {
    try {
        const result = await checkEligibilityAndGetDiscount(req.user.userId);
        res.status(200).json({
            success: true,
            data: result,
            message: result.isEligible
                ? "You are eligible for a Group Yatra loyalty discount!"
                : "No loyalty discount available at this time.",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/yatra-loyalty/history
 * User reward history (milestones, applied rewards).
 */
router.get("/history", protect, async (req, res) => {
    try {
        const result = await getRewardHistory(req.user.userId, req.query);
        res.status(200).json({
            success: true,
            ...result,
            message: "Reward history fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/yatra-loyalty/
 * Admin: paginated list of all loyalty records.
 */
router.get("/", protect, async (req, res) => {
    try {
        const { page, limit, ...filters } = req.query;
        const result = await getAllLoyaltyRecords({ page, limit }, filters);
        res.status(200).json({
            success: true,
            ...result,
            message: "Yatra loyalty records fetched successfully",
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
