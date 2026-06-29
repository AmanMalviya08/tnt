const mongoose = require("mongoose");
const CompanyController = require("../controller/companyController");
const companyModel = require("../models/companyModel");

const companyController = new CompanyController(companyModel);

async function connectDB() {
  const mongoUrl = process.env.MONGODB_URL?.trim();
  if (!mongoUrl) {
    console.error("❌ MONGODB_URL is not set in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUrl, {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 60000,
      serverSelectionTimeoutMS: 10000,
      readPreference: "primary",
    });

    console.log("✅ Database connected successfully");
    const companyExist = await companyController.getCompanyCount();

    // console.log(companyData)
    if (!companyExist) {
      const companyData = companyController.companyData()
      await companyController.createCompany(companyData)

    }

  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1); // Server ko band kar dega agar DB connect na ho
  }
}

module.exports = connectDB;
