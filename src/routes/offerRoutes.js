// Routes (bannerRoutes.js)
const express = require("express");
const OfferController = require("../controller/offerController");
const offerModel = require("../models/offerModel");

const router = express.Router();
const offerController = new OfferController(offerModel);

router.post("/", async (req, res) => {
    try {
        const banner = await offerController.addOffer(req.body);
        
        if (!banner) {
            return res.status(404).json({ 
                success: false, 
                message: "Banner failed to save" 
            });
        }

        res.status(200).json({
            success: true,
            data: banner,
            message: "Banner added successfully",
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const banner = await offerController.getOffer(req.params.id);
        
        if (!banner) {
            return res.status(404).json({ 
                success: false, 
                message: "Banner not found" 
            });
        }

        res.status(200).json({
            success: true,
            data: banner,
            message: "Banner retrieved successfully",
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
});

router.get("/", async (req, res) => {
    try {
        const { page, limit , type, ...filter}=req.query
        const result = await offerController.getAllOffers({page, limit , type }, filter);

        res.status(200).json({
            success: true,
            result,
            message: "Banners retrieved successfully",
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
});

module.exports = router;