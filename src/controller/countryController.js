const contryModel = require("../models/contryModel");

const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

class CountryController {
  constructor(model = contryModel) {
    this.model = model;
  }

  async createCountry(payload) {
    const body = { ...payload };

    if (!body.contryName || !body.contryName.trim()) {
      throw new Error("Country name is required");
    }

    body.contryName = body.contryName.trim();

    try {
      const country = new this.model(body);
      return await country.save();
    } catch (error) {
      if (error && error.code === 11000) {
        throw new Error("Country name must be unique");
      }
      throw error;
    }
  }

  async getCountries(filter = {}, options = {}) {
    const normalizedFilter = { ...filter };

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "isDisabled")) {
      const raw = normalizedFilter.isDisabled;
      if (typeof raw === "string") {
        normalizedFilter.isDisabled = raw === "true";
      } else {
        normalizedFilter.isDisabled = Boolean(raw);
      }
    } else {
      const includeDisabled =
        typeof options.includeDisabled === "string"
          ? options.includeDisabled === "true"
          : Boolean(options.includeDisabled);
      if (!includeDisabled) {
        normalizedFilter.isDisabled = false;
      }
    }

    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
    const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const query = this.model.find(normalizedFilter);

    let sort = options.sort || options.sortBy;
    if (typeof sort === "string" && sort.trim()) {
      const order = options.sortOrder || options.order;
      const direction = typeof order === "string" && order.toLowerCase() === "desc" ? -1 : 1;
      sort = { [sort]: direction };
    }

    if (!sort) {
      sort = { contryName: 1 };
    }

    query.sort(sort);
    query.skip((currentPage - 1) * pageSize).limit(pageSize);

    const [items, totalItems] = await Promise.all([
      query.exec(),
      this.model.countDocuments(normalizedFilter),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: items,
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

  async getCountryById(id) {
    return this.model.findById(id);
  }

  async updateCountry(id, payload) {
    const body = { ...payload };

    if (Object.prototype.hasOwnProperty.call(body, "contryName")) {
      if (!body.contryName || !body.contryName.trim()) {
        throw new Error("Country name is required");
      }

      body.contryName = body.contryName.trim();

      const duplicate = await this.model
        .findOne({ contryName: body.contryName })
        .collation({ locale: "en", strength: 2 });

      if (duplicate && duplicate.id !== id) {
        throw new Error("Country name must be unique");
      }
    }

    try {
      return await this.model.findByIdAndUpdate(id, body, {
        new: true,
        runValidators: true,
        context: "query",
      });
    } catch (error) {
      if (error && error.code === 11000) {
        throw new Error("Country name must be unique");
      }
      throw error;
    }
  }

  async setCountryDisabled(id, options = {}) {
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

    return this.model.findByIdAndUpdate(
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
    );
  }
}

module.exports = CountryController;
