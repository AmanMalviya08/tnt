const express = require("express");
const BlogController = require("../controller/blogController");
const { blogModel, blogStatuses } = require("../models/blogModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const blogController = new BlogController(blogModel);

router.post("/",protect, async (req, res) => {
  try {
    const blog = await blogController.createBlog(req.body);
    res.status(201).json({ success: true, message: "Blog created successfully", data: blog });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { page, limit, sort, ...filters } = req.query;
    const { data: blogs, pagination } = await blogController.getBlogs(filters, {
      page,
      limit,
      sort,
    });
    res
      .status(200)
      .json({
        success: true,
        message: "Blogs fetched successfully",
        data: blogs,
        pagination,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/slug/:slug", async (req, res) => {
  try {
    const blog = await blogController.getBlogBySlug(req.params.slug);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    res.status(200).json({ success: true, message: "Blog fetched successfully", data: blog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const blog = await blogController.getBlogById(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    res.status(200).json({ success: true, message: "Blog fetched successfully", data: blog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id",protect, async (req, res) => {
  try {
    const blog = await blogController.updateBlog(req.params.id, req.body);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    res.status(200).json({ success: true, message: "Blog updated successfully", data: blog });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id",protect, async (req, res) => {
  try {
    const blog = await blogController.deleteBlog(req.params.id);
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    res.status(200).json({ success: true, message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/meta/enums", (req, res) => {
  res.status(200).json({ success: true, data: { blogStatuses } });
});

module.exports = router;
