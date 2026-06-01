


const { wishlistModel } = require("../models/wishlistModel");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);
class WishlistController {
    constructor(model = wishlistModel) {
        this.model = model;
    }
    async addWishlist(payload) {
        const { userId, placeId, packageId, tourId } = payload

        let wishlistDocument = await this.model.findOne({ userId })

        if (!wishlistDocument) {
            wishlistDocument = await this.model.create({
                userId,
                placeId: placeId ? [placeId] : [],
                packageId: packageId ? [packageId] : [],
                tourId: tourId ? [tourId] : []
            })
            const populatedDoc = await this.model.findById(wishlistDocument._id)
                .populate('placeId')
                .populate('packageId')
                .populate('tourId');

            let toggledItem = null;
            if (packageId) {
                toggledItem = populatedDoc.packageId.find(p => p._id.toString() === packageId.toString());
            } else if (tourId) {
                toggledItem = populatedDoc.tourId.find(t => t._id.toString() === tourId.toString());
            } else if (placeId) {
                toggledItem = populatedDoc.placeId.find(p => p._id.toString() === placeId.toString());
            }

            return {
                wishlist: populatedDoc,
                action: "added",
                place: toggledItem
            }
        }

        const update = {};
        let action = "added";
        if (placeId) {
            const alreadyExists = wishlistDocument.placeId.includes(placeId)
            if (alreadyExists) {
                update.$pull = { ...update.$pull, placeId: placeId }
                action = "removed";
            } else {
                update.$addToSet = { ...update.$addToSet, placeId: placeId }
                action = "added";
            }
        }
        if (packageId) {
            const alreadyExists = wishlistDocument.packageId.includes(packageId)
            if (alreadyExists) {
                update.$pull = { ...update.$pull, packageId: packageId }
                action = "removed";
            } else {
                update.$addToSet = { ...update.$addToSet, packageId: packageId }
                action = "added";
            }
        }
        if (tourId) {
            const alreadyExists = wishlistDocument.tourId.includes(tourId)
            if (alreadyExists) {
                update.$pull = { ...update.$pull, tourId: tourId }
                action = "removed";
            } else {
                update.$addToSet = { ...update.$addToSet, tourId: tourId }
                action = "added";
            }
        }

        const updatedDoc = await this.model.findOneAndUpdate({ userId }, update, { new: true })
            .populate('placeId')
            .populate('packageId')
            .populate('tourId');

        let toggledItem = null;
        if (packageId) {
            toggledItem = updatedDoc.packageId.find(p => p._id.toString() === packageId.toString());
        } else if (tourId) {
            toggledItem = updatedDoc.tourId.find(t => t._id.toString() === tourId.toString());
        } else if (placeId) {
            toggledItem = updatedDoc.placeId.find(p => p._id.toString() === placeId.toString());
        }

        return {
            wishlist: updatedDoc,
            action,
            place: toggledItem
        };
    }

    async getWishlist(id, options = {}, filters = {}) {

        const parsedPage = parseInt(options.page, 10);
        const parsedLimit = parseInt(options.limit, 10);

        const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
        const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

        const checkDocument = await this.model.findOne({ userId: id })
        if (!checkDocument) {
            return {
                data: [],
                pagination: {
                    realTotalTime: 0,
                    totalPages: 0,
                    pageSize: 0,
                    currentPage: 0,
                    hasNextPage: false,
                    hasPrevPage: false,
                },
            };
        }
        const query = this.model.findOne({ userId: id })
            .populate({
                path: 'placeId',
                match: { placeName: { $regex: filters.search || '', $options: 'i' } },
                options: {
                    sort: { _id: -1 },
                    skip: (currentPage - 1) * pageSize,
                    limit: pageSize
                }
            })
            .populate({
                path: 'packageId',
                match: { packageName: { $regex: filters.search || '', $options: 'i' } },
                options: {
                    sort: { _id: -1 },
                    skip: (currentPage - 1) * pageSize,
                    limit: pageSize
                }
            })
            .populate({
                path: 'tourId',
                match: { tourName: { $regex: filters.search || '', $options: 'i' } },
                options: {
                    sort: { _id: -1 },
                    skip: (currentPage - 1) * pageSize,
                    limit: pageSize
                }
            })

        const [items, totalItems] = await Promise.all([
            query.exec(),
            this.model.findOne({ userId: id }),
        ]);
        const realTotalTime = Math.max(
            totalItems.placeId?.length || 0,
            totalItems.packageId?.length || 0,
            totalItems.tourId?.length || 0
        );
        const totalPages = Math.max(Math.ceil(realTotalTime / pageSize) || 1, 1);

        return {
            data: items,
            pagination: {
                realTotalTime,
                totalPages,
                pageSize,
                currentPage,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1,
            },
        };

    }


    async removeWishlist(id, payload) {
        const { userId } = payload
        const update = {}
        update.$pull = {
            wishlist: id
        }


        return this.model.findByIdAndUpdate(userId, update, { new: true, runValidators: true });

    }

}
module.exports = WishlistController;