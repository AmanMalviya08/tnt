const mongoose = require("mongoose");
const { generateSlug, ensureUniqueSlug } = require("../utils/slugHelper");

const blogStatuses = ["Draft", "Scheduled", "Published", "Archived"];

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    content: {
      type: String,
      required: true,
    },
    coverImage: {
      type: String,
      trim: true,
    },
    galleryImages: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    videoLink: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    author: {
      type: String,
      trim: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    publishDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: blogStatuses,
      default: "Draft",
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    seoTitle: {
      type: String,
      trim: true,
    },
    seoDescription: {
      type: String,
      trim: true,
    },
    seoKeywords: {
      type: [String],
      default: [],
    },
    readingTime: {
      type: Number,
      min: 0,
    },
    relatedPlaceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Place",
      },
    ],
    relatedPackageIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Package",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

blogSchema.pre("save", async function (next) {
  try {
    if (this.isModified("title") || this.isModified("slug") || !this.slug) {
      const rawSlug = this.slug ? generateSlug(this.slug) : generateSlug(this.title);
      const Blog = this.constructor;
      this.slug = await ensureUniqueSlug(Blog, rawSlug, this._id);
    }

    if (!this.readingTime && this.content) {
      const words = this.content.split(/\s+/).filter(Boolean).length;
      this.readingTime = Math.ceil(words / 200);
    }

    next();
  } catch (error) {
    next(error);
  }
});

blogSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    const payload = update.$set ? update.$set : update;

    if (payload.title || payload.slug) {
      const Blog = mongoose.model("Blog");
      const rawSlug = payload.slug ? generateSlug(payload.slug) : generateSlug(payload.title);
      const uniqueSlug = await ensureUniqueSlug(Blog, rawSlug, this.getQuery()._id);

      if (update.$set) {
        update.$set.slug = uniqueSlug;
      } else {
        update.slug = uniqueSlug;
      }
    }

    if ((payload.content || payload.readingTime === undefined) && (payload.content || update.$set)) {
      const newContent = payload.content;
      if (newContent) {
        const words = newContent.split(/\s+/).filter(Boolean).length;
        const minutes = Math.ceil(words / 200);
        if (update.$set) {
          update.$set.readingTime = minutes;
        } else {
          update.readingTime = minutes;
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

const blogModel = mongoose.model("Blog", blogSchema);

module.exports = {
  blogModel,
  blogStatuses,
};
