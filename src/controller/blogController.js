const { blogModel } = require("../models/blogModel");

class BlogController {
  constructor(model = blogModel) {
    this.model = model;
  }

  async createBlog(payload) {
    const blog = new this.model(payload);
    return blog.save();
  }

  async getBlogs(filter = {}, options = {}) {
    const normalizedFilter = { ...filter };
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "q")) {
     const value = normalizedFilter.q;
     if (value && value.trim()) {
       normalizedFilter.title = { $regex: value.trim(), $options: "i" };
     }
     delete normalizedFilter.q;
   }
    const query = this.model.find(normalizedFilter);

    if (options.sort) {
      query.sort(options.sort);
    }

    const parsedLimit = parseInt(options.limit, 10);
    const shouldPaginate = !Number.isNaN(parsedLimit) && parsedLimit > 0;


    let currentPage = 1;
    if (shouldPaginate) {
      currentPage = parseInt(options.page, 10);
      if (Number.isNaN(currentPage) || currentPage < 1) {
        currentPage = 1;
      }

      const skip = (currentPage - 1) * parsedLimit;
      query.skip(skip).limit(parsedLimit);
    }

    const [data, totalItems] = await Promise.all([
      query.exec(),
      this.model.countDocuments(filter),
    ]);

    let pagination = null;
    if (shouldPaginate) {
      const totalPages = Math.max(Math.ceil(totalItems / parsedLimit), 1);
      pagination = {
        totalItems,
        totalPages,
        currentPage,
        pageSize: parsedLimit,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      };
    }

    return { data, pagination };
  }

  async getBlogById(id) {
    return this.model.findById(id);
  }

  async getBlogBySlug(slug) {
    return this.model.findOne({ slug });
  }

  async updateBlog(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  }

  async deleteBlog(id) {
    return this.model.findByIdAndDelete(id);
  }
}

module.exports = BlogController;
