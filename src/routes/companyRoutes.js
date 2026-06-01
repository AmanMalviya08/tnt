const express = require("express");
const CompanyController = require("../controller/companyController");
const companyModel = require("../models/companyModel");



const router = express.Router();
const companyController = new CompanyController(companyModel)
router.get("/", async (req, res) => {
  try {
    const company = await companyController.getCompany();
    
    res.status(201).json({ success: true, message: "Company Fetched successfully", data: company });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.get("/assetlinks", async (req, res) => {
  try {
    const data = await companyController.getAndroidAssetLinks();
    res.status(200).json({data:data});
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.put("/", async (req, res) => {
  try {
     
    // console.log("here")
    const company = await companyController.updateCompany(req.body);
    
    res.status(201).json({ success: true, message: "Company Update successfully", data: company });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
