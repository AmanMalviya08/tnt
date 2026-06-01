const express = require("express");
const BenefitController = require("../controller/benefitController");
const BenefitModel = require("../models/benefitModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const benefitController = new BenefitController(BenefitModel);

router.post("/", protect, async (req, res) => {
    try {
        const benefit = await benefitController.createBenefit(req.body);
        res.status(201).json({
            success: true,
            data: benefit,
            message: "Benefit created successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const { page, limit, sort, ...filters } = req.query;
        const benefits = await benefitController.getBenefits(
            { page, limit, sort },
            filters
        );

        res.status(200).json({
            success: true,
            ...benefits,
            message: "Benefits fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const benefit = await benefitController.getBenefitById(id);

        if (!benefit) {
            return res
                .status(404)
                .json({ success: false, message: "Benefit not found" });
        }

        res.status(200).json({
            success: true,
            data: benefit,
            message: "Benefit fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.put("/:id", protect, async (req, res) => {
    try {
        const { id } = req.params;
        const benefit = await benefitController.updateBenefit(id, req.body);

        if (!benefit) {
            return res
                .status(404)
                .json({ success: false, message: "Benefit not found" });
        }

        res.status(200).json({
            success: true,
            data: benefit,
            message: "Benefit updated successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.delete("/:id", protect, async (req, res) => {
    try {
        const { id } = req.params;
        const benefit = await benefitController.deleteBenefit(id);

        if (!benefit) {
            return res
                .status(404)
                .json({ success: false, message: "Benefit not found" });
        }

        res.status(200).json({
            success: true,
            data: benefit,
            message: "Benefit deleted successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
