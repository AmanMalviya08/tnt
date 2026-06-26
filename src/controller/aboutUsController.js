const {AboutUsModel}=require('../models/aboutUsModel')
class AboutUsController {
    constructor(model = AboutUsModel) {
        this.model = model;
    }

    async getAboutUsPage() {
        const pages = await this.model.find({}).sort({ updatedAt: -1 }).lean();

        if (!pages?.length) {
            return [];
        }

        return pages;
    }

    async getAboutUsPagePublic() {
        const page = await this.model
            .findOne({ isActive: { $ne: false } })
            .sort({ updatedAt: -1 })
            .lean();

        if (page) return page;

        const fallback = await this.model.findOne().sort({ updatedAt: -1 }).lean();
        return fallback || null;
    }
    async createAboutUsPage(payload) {
        
         
        const newPage = await this.model.create(payload);
        return newPage;
    }

    async updateAboutUsPage(payload) {
        const updatedPage = await this.model.findOneAndUpdate(
            {},
            { ...payload, lastUpdated: Date.now() },
            { new: true, runValidators: true }
        );
        // console.log(updatedPage)
    
        if (!updatedPage) {
            throw new Error('About Us page not found');
        }

        return updatedPage;
    }

    async deleteAboutUsPage() {
        const deletedPage = await this.model.findOneAndDelete({});

        if (!deletedPage) {
            throw new Error('About Us page not found');
        }

        return deletedPage;
    }
}

module.exports = AboutUsController;