const { offerModel } = require("../models/offerModel");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

class OfferController {
    constructor(model = offerModel) {
        this.model = model;
    }

    async addOffer(payload) {
        console.log("inside add banner")
        const banner = await this.model.create(payload);
        return banner;
    }

    async getOffer(id) {
        const banner = await this.model.findById(id);
        return banner;
    }

    async getAllOffers(options = {} , filter={}) {
        const { page = 1, limit = DEFAULT_PAGE_SIZE, type, isDisabled } = options;
       const parsedPage = parseInt(page, 10);
        const parsedLimit = parseInt(limit, 10);
 
        const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
        const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;
        const normalisedFilter = {};
        if (type) normalisedFilter.type = type;
        if (isDisabled !== undefined) normalisedFilter.isDisabled = isDisabled;
 
        const banners = await this.model
            .find(normalisedFilter)
            .skip((currentPage - 1) * pageSize)
            .limit(parseInt(pageSize))
            .sort({ createdAt: -1 });

        const totalItems = await this.model.countDocuments(normalisedFilter);

        
        const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

        return {
                data:banners,
                pagination:{

                    totalItems,
                    totalPages,
                    pageSize,
                    currentPage,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1,
                }
        };
    }
}

module.exports = OfferController;