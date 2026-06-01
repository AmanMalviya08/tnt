const express = require("express");
const AboutUsController = require("../controller/aboutUsController");
const AboutUsModel = require("../models/aboutUsModel");
const router = express.Router();
const aboutUsController = new AboutUsController(AboutUsModel);
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

// router.post("/", async (req, res) => {
//     try {
//         console.log(req.body)
//         console.log(aboutUsController)
//         const aboutUsPage = await aboutUsController.createAboutUsPage(req.body);

//         res.status(201).json({
//             success: true,
//             data: aboutUsPage,
//             message: "About Us page created successfully",
//         });
//     } catch (error) {
//         res.status(400).json({ success: false, message: error.message });
//     }
// });

router.put("/", async (req, res) => {
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

// router.delete("/", async (req, res) => {
//     try {
//         const aboutUsPage = await aboutUsController.deleteAboutUsPage();

//         res.status(200).json({
//             success: true,
//             data: aboutUsPage,
//             message: "About Us page deleted successfully",
//         });
//     } catch (error) {
//         res.status(404).json({ success: false, message: error.message });
//     }
// });

module.exports = router;