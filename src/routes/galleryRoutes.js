const express = require("express");
const router = express.Router();
const GalleryController = require("../controller/galleryController");

const galleryController = new GalleryController();

router.get("/", async (req, res) => {
  try {
    const galleries = await galleryController.getAllGalleries(req.query);
    res.json({
      success: true,
      data: galleries?.galleries,
      pagination: galleries.pagination,
      message: "gallery fetched successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const gallery = await galleryController.getGalleryById(req.params.id);
    res.json({
      success: true,
      data: gallery,
      message: "gallery fetched successfully",
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

router.get("/package/:packageId", async (req, res) => {
  try {
    const galleries = await galleryController.getGalleriesByPackage(
      req.params.packageId,
    );
    res.json({
      success: true,
      data: galleries,
      message: "gallery fetched successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post("/", async (req, res) => {
  try {
    const gallery = await galleryController.createGallery(req.body);
    res.status(201).json({
      success: true,
      data: gallery,
      message: "gallery created successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.put("/:id", async (req, res) => {
  try {
    const gallery = await galleryController.updateGallery(
      req.params.id,
      req.body,
    );
    res.json({
      success: true,
      data: gallery,
      message: "gallery updated successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/images/:id", async (req, res) => {
  try {
    const gallery = await galleryController.addImages(
      req.params.id,
      req.body.images,
    );
    res.json({
      success: true,
      data: gallery,
      message: "images added successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.post("/videos/:id", async (req, res) => {
  try {
    const gallery = await galleryController.addVideos(
      req.params.id,
      req.body.videos,
    );
    res.json({
      success: true,
      data: gallery,
      message: "videos added successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.patch("/removeImage/:galleryId/:imageId", async (req, res) => {
  try {
    const { galleryId, imageId } = req.params;
    const gallery = await galleryController.removeImage(galleryId, imageId);
    res.json({
      success: true,
      data: gallery,
      message: "gallery deleted successfully",
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});
router.patch("/removeVideos/:galleryId/:videoId", async (req, res) => {
  try {
    const { galleryId, videoId } = req.params;
    const gallery = await galleryController.removeVideo(galleryId, videoId);
    res.json({
      success: true,
      data: gallery,
      message: "gallery deleted successfully",
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});
router.patch("/updateVideos/:galleryId/:videoId", async (req, res) => {
  try {
    const { galleryId, videoId } = req.params;
    const gallery = await galleryController.updateVideo(
      galleryId,
      videoId,
      req.body,
    );
    res.json({
      success: true,
      data: gallery,
      message: "gallery deleted successfully",
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const gallery = await galleryController.deleteGallery(req.params.id);
    res.json({
      success: true,
      data: gallery,
      message: "gallery deleted successfully",
    });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const gallery = await galleryController.toggleGalleryStatus(req.params.id);
    res.json({ success: true, data: gallery, message: "successfull" });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

module.exports = router;
