const express = require("express");
const UploadController = require("../controller/uploadController");
const { uploadAny } = require("../middleware/s3Upload");

const router = express.Router();

const handleUpload = (handler) => (req, res) => {
  uploadAny()(req, res, (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }
    return handler(req, res);
  });
};

router.post("/single", handleUpload(UploadController.single));
router.post("/multiple", handleUpload(UploadController.multiple));

module.exports = router;
