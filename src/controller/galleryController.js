const { default: mongoose } = require("mongoose");
const GalleryModel = require("../models/galleryModel");

class GalleryController {
  constructor(model = GalleryModel) {
    this.model = model;
  }
  async getAllGalleries(filters = {}) {
    const filter = {};
    if (filters.stateId && filters.stateId.trim()) {
      filter.stateId = new mongoose.Types.ObjectId(filters.stateId.trim());
    }
    // const stateId = filters.stateId;
    const parsedPage = parseInt(filters.page, 10);
    const parsedLimit = parseInt(filters.limit, 10);

    const pageSize =
      !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const currentPage =
      !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    // const matchStage = {}
    // if (stateId) {
    //     matchStage.$or = [
    //         { 'packageCities.stateId': new mongoose.Types.ObjectId(stateId) },
    //         { 'tourCities.stateId': new mongoose.Types.ObjectId(stateId) }
    //     ];
    // }
    if (filters.isDisabled === 'true') {
      filter.isDisabled = true;
    } else if (filters.isDisabled === 'false') {
      filter.isDisabled = false
    }

    if (filters.search && filters.search.trim()) {
      const StateModel = require("../models/stateModel");
      const matchedStates = await StateModel.find({
        stateName: { $regex: filters.search.trim(), $options: "i" }
      }).select("_id");

      const stateIds = matchedStates.map(state => state._id);

      // If there's already a stateId from another filter, we only want the intersection.
      // Easiest way in Mongoose is to just use $in if it's not overriding an exact match.
      if (filter.stateId) {
        // If a specific stateId was provided AND a search string, ensure the specific stateId matches the search
        if (!stateIds.some(id => id.equals(filter.stateId))) {
          // If the selected state doesn't match the search text, return no results
          filter.stateId = null;
        }
      } else {
        filter.stateId = { $in: stateIds };
      }
    }

    console.log(filter, filters)
    const galleries = await this.model
      .find(filter)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .sort({ order: -1 })
      .populate("stateId")
      .lean();

    galleries.forEach((gallery) => {
      if (Array.isArray(gallery.images)) {
        gallery.images.sort((a, b) => a.order - b.order);
      }

      if (Array.isArray(gallery.videos)) {
        gallery.videos.sort((a, b) => a.order - b.order);
      }
    });

    const totalItems = await this.model.countDocuments(filter);
    // const result = await this.model.aggregate(pipeline);
    // const totalItems = result[0].metadata[0]?.totalItems || 0;
    // const galleries = result[0].data || [];
    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      galleries,
      pagination: {
        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async getGalleryById(galleryId) {
    const gallery = await this.model
      .findById(galleryId)
      .populate("packageId")
      .populate("tourId")
      .lean();

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    if (Array.isArray(gallery.images)) {
      gallery.images.sort((a, b) => a.order - b.order);
    }

    if (Array.isArray(gallery.videos)) {
      gallery.videos.sort((a, b) => a.order - b.order);
    }

    return gallery;
  }

  async getGalleriesByPackage(packageId) {
    const gallery = await this.model
      .findById(packageId)
      .populate("packageId")
      .populate("tourId")
      .lean();

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    if (Array.isArray(gallery.images)) {
      gallery.images.sort((a, b) => a.order - b.order);
    }

    if (Array.isArray(gallery.videos)) {
      gallery.videos.sort((a, b) => a.order - b.order);
    }

    return gallery;
  }

  async getGalleriesByTour(tourId) {
    const gallery = await this.model
      .findById({ tourId, isDisabled: false })
      .populate("packageId")
      .populate("tourId")
      .lean();

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    if (Array.isArray(gallery.images)) {
      gallery.images.sort((a, b) => a.order - b.order);
    }

    if (Array.isArray(gallery.videos)) {
      gallery.videos.sort((a, b) => a.order - b.order);
    }

    return gallery;
  }

  async createGallery(payload) {
    const newGallery = await this.model.create(payload);
    return newGallery;
  }

  async updateGallery(galleryId, payload) {
    const updatedGallery = await this.model.findByIdAndUpdate(
      galleryId,
      payload,
      { new: true, runValidators: true },
    );

    if (!updatedGallery) {
      throw new Error("Gallery not found");
    }

    return updatedGallery;
  }

  async addImages(galleryId, images) {
    const gallery = await this.model.findById(galleryId);
    if (!gallery) {
      throw new Error("Gallery not found");
    }

    validateUniqueOrder(gallery.images, images);

    gallery.images.push(...images);
    await gallery.save();

    return gallery;
  }

  async removeImage(galleryId, imageId) {
    const gallery = await this.model.findById(galleryId);

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    gallery.images = gallery.images.filter(
      (img) => img._id.toString() !== imageId,
    );
    await gallery.save();

    return gallery;
  }

  async updateImage(galleryId, imageId, imageData) {
    const gallery = await this.model.findById(galleryId);

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    const imageIndex = gallery.images.findIndex(
      (img) => img._id.toString() === imageId,
    );

    if (imageIndex === -1) {
      throw new Error("Image not found in gallery");
    }
    if (
      imageData.order !== undefined &&
      gallery.images.some(
        (img, idx) => idx !== imageIndex && img.order === imageData.order,
      )
    ) {
      throw new Error(`Order ${imageData.order} already exists`);
    }
    gallery.images[imageIndex] = {
      ...gallery.images[imageIndex].toObject(),
      ...imageData,
    };
    await gallery.save();
    return gallery;
  }

  async toggleGalleryStatus(galleryId) {
    const getDisabled = await this.model
      .findById(galleryId)
      .select("isDisabled");
    const isDisabled = getDisabled.isDisabled;
    const gallery = await this.model.findByIdAndUpdate(
      galleryId,
      { isDisabled: !isDisabled },
      { new: true },
    );

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    return gallery;
  }

  async addVideos(galleryId, videos) {
    const gallery = await this.model.findById(galleryId);

    if (!gallery) {
      throw new Error("Gallery not found");
    }
    validateUniqueOrder(gallery.videos, videos);
    gallery.videos.push(...videos);
    await gallery.save();

    return gallery;
  }

  async removeVideo(galleryId, videoId) {
    const gallery = await this.model.findById(galleryId);

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    gallery.videos = gallery.videos.filter(
      (video) => video._id.toString() !== videoId,
    );
    await gallery.save();

    return gallery;
  }

  async updateVideo(galleryId, videoId, videoData) {
    const gallery = await this.model.findById(galleryId);

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    const videoIndex = gallery.videos.findIndex(
      (video) => video._id.toString() === videoId,
    );

    if (videoIndex === -1) {
      throw new Error("Video not found in gallery");
    }

    if (
      videoData.order !== undefined &&
      gallery.videos.some(
        (v, idx) => idx !== videoIndex && v.order === videoData.order,
      )
    ) {
      throw new Error(`Order ${videoData.order} already exists`);
    }

    gallery.videos[videoIndex] = {
      ...gallery.videos[videoIndex].toObject(),
      ...videoData,
    };

    await gallery.save();

    return gallery;
  }

  async reorderVideos(galleryId, videoOrders) {
    const gallery = await this.model.findById(galleryId);

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    videoOrders.forEach(({ videoId, order }) => {
      const video = gallery.videos.id(videoId);
      if (video) {
        video.order = order;
      }
    });

    await gallery.save();
    return gallery;
  }

  async deleteGallery(galleryId) {
    const deletedGallery = await this.model.findByIdAndDelete(galleryId);

    if (!deletedGallery) {
      throw new Error("Gallery not found");
    }

    return deletedGallery;
  }

  async reorderImages(galleryId, imageOrders) {
    const gallery = await this.model.findById(galleryId);

    if (!gallery) {
      throw new Error("Gallery not found");
    }

    imageOrders.forEach(({ imageId, order }) => {
      const image = gallery.images.id(imageId);
      if (image) {
        image.order = order;
      }
    });

    await gallery.save();
    return gallery;
  }

  async validateUniqueOrder(existing = [], incoming = []) {
    const existingOrders = new Set(existing.map((i) => i.order));
    const incomingOrders = new Set();

    for (const item of incoming) {
      if (existingOrders.has(item.order)) {
        throw new Error(`Order ${item.order} already exists`);
      }

      if (incomingOrders.has(item.order)) {
        throw new Error(`Duplicate order ${item.order} in request`);
      }

      incomingOrders.add(item.order);
    }
  }
}
module.exports = GalleryController;
