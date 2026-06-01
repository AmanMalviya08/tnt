const {AboutUsModel}=require('../models/aboutUsModel')
class AboutUsController {
    constructor(model = AboutUsModel) {
        this.model = model;
    }

    async getAboutUsPage() {
        const page = await this.model.find({});
        
        
        if (!page) {
            throw new Error('About Us page not found');
        }
        
        return page;
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