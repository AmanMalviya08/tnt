const express = require("express");
const ContactUsController = require('../controller/contactUsController')
const contactUsModel= require('../models/contactUsModel');
const { protect } = require("../middleware/authMiddleware");



const router = express.Router();
const contactUsController = new ContactUsController(contactUsModel)
router.post("/",protect, async (req, res) => {
  try {
     
    const contactUs = await contactUsController.createContactUs(req.body);
    
    res.status(201).json({ success: true, message: "Contact Us Fetched successfully", data: contactUs });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/export/excel", protect, async (req, res) => {
  try {
    await contactUsController.exportContactUsExcel(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", protect,async (req, res) => {
  try {
    const {id}= req.params;
    const contactUs = await contactUsController.getContactUsById(id);
    
    res.status(201).json({ success: true, message: "Contact Us Fetched successfully", data: contactUs });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.get("/",protect, async (req, res) => {
  
  try {
    const { page, limit, sort, ...filters } = req.query;
    const { data: contactUs, pagination } = await contactUsController.getContactUs(filters, {
      page,
      limit,
      sort,
    });
    res
      .status(200)
      .json({
        success: true,
        message: "Contact Us fetched successfully",
        data: contactUs,
        pagination,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
