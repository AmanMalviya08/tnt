const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const rewardController = require("../controller/rewardController");

const router = express.Router();

// GET /api/rewards/status — Agent checks their reward progress
router.get("/status", protect, async (req, res) => {
    try {
        const status = await rewardController.getRewardStatus(req.user.userId);
        res.status(200).json({
            success: true,
            data: status,
            message: "Reward status fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// POST /api/rewards/claim — Agent claims free package
router.post("/claim", protect, async (req, res) => {
    try {
        const { packageId } = req.body;

        if (!packageId) {
            return res.status(400).json({
                success: false,
                message: "packageId is required",
            });
        }

        const result = await rewardController.claimFreePackage(
            req.user.userId,
            packageId
        );

        res.status(201).json({
            success: true,
            data: result,
            message: "Free package reward claimed successfully!",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET /api/rewards/history — Agent's past rewards
router.get("/history", protect, async (req, res) => {
    try {
        const rewards = await rewardController.getRewardHistory(
            req.user.userId
        );
        res.status(200).json({
            success: true,
            data: rewards,
            message: "Reward history fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// GET /api/rewards/ — Admin view all rewards
router.get("/", protect, async (req, res) => {
    try {
        const { page, limit, ...filters } = req.query;
        const rewards = await rewardController.getAllRewards(
            { page, limit },
            filters
        );
        res.status(200).json({
            success: true,
            ...rewards,
            message: "Rewards fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
