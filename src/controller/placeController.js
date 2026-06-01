const { placeModel } = require("../models/placeModel");
const { contryModel } = require("../models/contryModel");
const { default: mongoose } = require("mongoose");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

class PlaceController {
  constructor(model = placeModel) {
    this.model = model;
  }

  async createPlace(payload) {
    const place = new this.model(payload);
    return place.save();
  }


  async getPlaces(filter = {}, options = {}) {
    const normalizedFilter = { ...filter };
    let countryId = undefined;
    let userId = undefined;

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "cityId")) {
      const value = normalizedFilter.cityId;

      if (value && mongoose.Types.ObjectId.isValid(value)) {
        normalizedFilter.cityId = new mongoose.Types.ObjectId(value)
      }

    }
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "userId")) {
      const value = normalizedFilter.userId;

      if (value && mongoose.Types.ObjectId.isValid(value)) {
        userId = new mongoose.Types.ObjectId(value)
      }
      delete normalizedFilter.userId;

    }
    let priceFilter = undefined
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "min") && Object.prototype.hasOwnProperty.call(normalizedFilter, "max")) {
      const minValue = parseFloat(normalizedFilter.min.trim());
      const maxValue = parseFloat(normalizedFilter.max.trim());

      if (minValue && maxValue) {
        priceFilter = {
          $match: {
            "package.basePricePerPerson": {


              $gte: minValue,
              $lte: maxValue
            }
          }
        };
      }

      delete normalizedFilter.min;
      delete normalizedFilter.max;
    }
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "countryId")) {
      const value = normalizedFilter.countryId;
      if (value && mongoose.Types.ObjectId.isValid(value)) {
        countryId = new mongoose.Types.ObjectId(value)
      }

      delete normalizedFilter.countryId;
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "isDisabled")) {
      const raw = normalizedFilter.isDisabled;
      if (raw === 'true') {
        normalizedFilter.isDisabled = true;
      } else if (raw === 'false') {
        normalizedFilter.isDisabled = false
      } else {
        delete normalizedFilter.isDisabled
      }

    } else {

      if (options.isDisabled === 'true') {
        normalizedFilter.isDisabled = true
      } else if (options.isDisabled === 'false') {
        normalizedFilter.isDisabled = false
      }

    }
    console.log(normalizedFilter)

    let searchValue = null;
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "search")) {
      const value = normalizedFilter.search;
      if (value && value.trim()) {
        searchValue = value.trim();
      }
      delete normalizedFilter.search;
    }

    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
    const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    // console.log(countryId)
    // const query = this.model
    //   .find(normalizedFilter)
    //   .populate({
    //     path: 'cityId',
    //   })
    //   .populate("nearbyAttractions");

    let sort = options.sort || options.sortBy;
    if (typeof sort === "string" && sort.trim()) {
      const order = options.sortOrder || options.order;
      const direction = typeof order === "string" && order.toLowerCase() === "desc" ? -1 : 1;
      sort = { [sort]: direction };
    }

    if (!sort) {
      sort = { placeName: 1 };
    }

    // query.sort(sort);
    // query.skip((currentPage - 1) * pageSize).limit(pageSize);
    const [items, totalItems] = await Promise.all([
      // query.exec()
      this.model.aggregate([
        { $match: normalizedFilter },
        {
          $lookup: {
            from: 'cities',
            localField: 'cityId',
            foreignField: '_id',
            as: 'city'
          }
        },
        { $unwind: '$city' },
        ...(countryId ? [{ $match: { "city.countryId": countryId } }] : []),
        ...(searchValue ? [{
          $match: {
            $or: [
              { placeName: { $regex: searchValue, $options: "i" } },
              { "city.cityName": { $regex: searchValue, $options: "i" } }
            ]
          }
        }] : []),
        {
          $lookup: {
            from: 'packages',
            localField: '_id',
            foreignField: 'placeIds',
            as: 'package'
          }
        },
        { $unwind: { path: '$package', preserveNullAndEmptyArrays: true } },
        // ...(priceFilter ? [priceFilter] : []),
        ...(userId ? [

          {
            $lookup: {
              from: 'wishlists',
              let: { placeId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $in: ['$$placeId', { $ifNull: ['$packageId', []] }] },
                        { $eq: ['$userId', userId] }

                      ]
                    }
                  }
                }
              ],
              as: 'wishlistData'
            }
          }
          ,
          {
            $addFields: {
              isWishlist: { $gt: [{ $size: '$wishlistData' }, 0] }
            }
          },
          {
            $project: {
              wishlistData: 0
            }
          },
        ] : []),
        ...(priceFilter ? [priceFilter] : []),
        // {$match:{'package.basePricePerPerson':{$gte:100 , $lte:400}}},
        {
          $sort: sort
        },
        { $skip: (currentPage - 1) * pageSize },
        { $limit: pageSize }


        // {$match:{"city.countryId":new mongoose.Types.ObjectId(countryId)}}
      ])
      , this.model.countDocuments(normalizedFilter)
    ]);

    // const packages=await this.model.find({
    //   {$match:}
    // })

    const filteredData = items.filter((places) => places.cityId !== null)
    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);
    // console.log(minMax)
    return {
      data: filteredData,
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

  async getPlaceById(id) {
    //     const place = await this.model.findById(id)
    //   .populate({
    //     path: 'package',
    //     select: 'packageName packageType durationDays basePricePerPerson'
    //   });
    // console.log(place)
    return this.model.findById(id).populate("cityId package").populate("nearbyAttractions");
  }

  async updatePlace(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  }

  async setPlaceDisabled(id, options = {}) {
    const existing = await this.model.findById(id).select("isDisabled");
    if (!existing) {
      return null;
    }

    let { isDisabled } = options;

    if (typeof isDisabled === "string") {
      isDisabled = isDisabled === "true";
    }

    if (typeof isDisabled === "undefined") {
      isDisabled = !existing.isDisabled;
    } else {
      isDisabled = Boolean(isDisabled);
    }

    return this.model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            isDisabled,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      )
      .populate("cityId")
      .populate("nearbyAttractions");
  }
  //  async  getPlaceFilterData(){
  //    const country= await contryModel.find()
  //    return country;

  //  }
  async deletePlace(id) {
    return this.model.deleteOne({ _id: id })

  }

}

module.exports = PlaceController;
