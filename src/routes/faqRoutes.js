const express = require("express");
const FaqController = require("../controller/faqController");
const faqModel = require("../models/faqModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const faqController = new FaqController(faqModel);

router.post("/", protect, async (req, res) => {
    try {
        const faq = await faqController.createFaq(req.body);
        res.status(201).json({
            success: true,
            data: faq,
            message: "FAQ created successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const { page, limit, sort, ...filters } = req.query;
        const faqs = await faqController.getFaqs({ page, limit, sort }, filters);

        res.status(200).json({
            success: true,
            data: faqs,
            message: "FAQs fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await faqController.getFaqById(id);

        if (!faq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }

        res.status(200).json({
            success: true,
            data: faq,
            message: "FAQ fetched successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.put("/:id", protect, async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await faqController.updateFaq(id, req.body);

        if (!faq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }

        res.status(200).json({
            success: true,
            data: faq,
            message: "FAQ updated successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

router.delete("/:id", protect, async (req, res) => {
    try {
        const { id } = req.params;
        const faq = await faqController.deleteFaq(id);

        if (!faq) {
            return res.status(404).json({ success: false, message: "FAQ not found" });
        }

        res.status(200).json({
            success: true,
            data: faq,
            message: "FAQ deleted successfully",
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;