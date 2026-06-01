const express = require("express");
const UploadController = require("../controller/uploadController");
const { uploadAny } = require("../middleware/s3Upload");

const router = express.Router();

router.post("/single", uploadAny(), UploadController.single);
router.post("/multiple", uploadAny(), UploadController.multiple);

module.exports = router;
