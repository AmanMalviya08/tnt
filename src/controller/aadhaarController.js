const { verifyAndFetchName } = require("../services/aadhaarVerificationService");

class AadhaarController {
  async verifyAadhaar(req, res) {
    try {
      const { aadhaarNumber } = req.body;
      if (!aadhaarNumber) {
        return res.status(400).json({
          success: false,
          message: "Aadhaar number is required",
        });
      }

      const result = await verifyAndFetchName(aadhaarNumber);
      return res.status(200).json({
        success: true,
        message: "Aadhaar verified successfully",
        data: result,
      });
    } catch (error) {
      const status =
        error.code === "INVALID_AADHAAR" ? 400 :
        error.code === "AADHAAR_PROVIDER_NOT_CONFIGURED" ? 503 :
        error.statusCode || 500;

      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
  }
}

module.exports = new AadhaarController();
