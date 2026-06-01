const faqModel = require("../models/faqModel");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

class FaqController {
    constructor(model = faqModel) {
        this.model = model;
    }

    async createFaq(payload) {
        const { question, answer } = payload;
        const faq = await this.model.create({ question, answer });
        return faq;
    }

    async getFaqs(options = {}, filters = {}) {
        const parsedPage = parseInt(options.page, 10);
        const parsedLimit = parseInt(options.limit, 10);

        const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
        const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

        const searchQuery = {
            isDisabled: false,
            ...(filters.search && {
                $or: [
                    { question: { $regex: filters.search, $options: 'i' } },
                    { answer: { $regex: filters.search, $options: 'i' } }
                ]
            }),
        };

        const query = this.model.find(
            searchQuery
        )
            .sort({ _id: -1 })
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize);

        const [items, totalItems] = await Promise.all([
            query.exec(),
            this.model.countDocuments(searchQuery)
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

    async getFaqById(id) {
        return this.model.findById(id);
    }

    async updateFaq(id, payload) {
        return this.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    }

    async deleteFaq(id) {
        return this.model.findByIdAndDelete(id);
    }
}

module.exports = FaqController;