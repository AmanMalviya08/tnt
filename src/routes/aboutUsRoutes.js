const express = require("express");
const AboutUsController = require("../controller/aboutUsController");
const AboutUsModel = require("../models/aboutUsModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const aboutUsController = new AboutUsController(AboutUsModel);

/** Admin — full list (legacy shape for admin panel) */
router.get("/", async (req, res) => {
    try {
        const aboutUsPage = await aboutUsController.getAboutUsPage();

        res.status(200).json({
            success: true,
            data: aboutUsPage,
            message: "About Us page fetched successfully",
        });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
});

/** Mobile apps — single active page */
router.get("/public", async (req, res) => {
    try {
        const aboutUsPage = await aboutUsController.getAboutUsPagePublic();

        if (!aboutUsPage) {
            return res.status(404).json({
                success: false,
                message: "About Us page not configured yet",
            });
        }

        return res.status(200).json({
            success: true,
            data: aboutUsPage,
            message: "About Us page fetched successfully",
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

router.put("/", protect, async (req, res) => {
    try {
        const aboutUsPage = await aboutUsController.updateAboutUsPage(req.body);

        res.status(200).json({
            success: true,
            data: aboutUsPage,
            message: "About Us page updated successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
