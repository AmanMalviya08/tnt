const path = require("path");

const normalizeKey = (s3Object) => {
  if (!s3Object) {
    return null;
  }

  if (s3Object.key || s3Object.Key) {
    return s3Object.key || s3Object.Key;
  }

  if (s3Object.location) {
    try {
      const url = new URL(s3Object.location);
      return url.pathname.replace(/^\//, "");
    } catch (error) {
      return null;
    }
  }

  return null;
};

class UploadController {
  static single(req, res) {
    const file = req.file || (Array.isArray(req.files) ? req.files[0] : null);

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const key = normalizeKey(file);
    const location = file.location || file.Location;
    const originalName = file.originalname;
    const mimeType = file.mimetype;
    const size = file.size;

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        key,
        location,
        originalName,
        mimeType,
        size,
      },
    });
  }

  static multiple(req, res) {
    const filesSource = Array.isArray(req.files)
      ? req.files
      : req.file
      ? [req.file]
      : [];

    if (!filesSource.length) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const files = filesSource.map((file) => ({
      key: normalizeKey(file),
      location: file.location || file.Location,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    }));

    return res.status(201).json({
      success: true,
      message: "Files uploaded successfully",
      data: files,
    });
  }
}

module.exports = UploadController;
