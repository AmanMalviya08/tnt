const { default: mongoose } = require('mongoose');
const fs = require('fs');
const path = require('path');
const companyModel = require('../models/companyModel');
class CompanyController {
    constructor(model = companyModel) {
        this.model = model;
    }

    async createCompany(payload) {

        const company = new this.model(payload);
        return company.save();
    }
    async getCompanyCount() {
        const count = this.model.countDocuments()

        return count;
    }
    async getCompany() {



        const company = this.model.findOne()
        return company;
    }
    async updateCompany(payload) {
        console.log(payload)

        return this.model.updateOne(
            { $set: payload }
        )


        // return this.model.findByIdAndUpdate(id, payload,{ new: true, runValidators: true });
    }
    companyData() {


        const companyData = {
            name: "Tour & Travels",
            logo: "testing logo ",
            termsAndCondition: "testing terms",
            privacyPolicy: "testing privacy",
            supportEmail: "testing support ",
            aboutUs: "testing about",
            contactNumber: "123456789",
            helpAndSupport: "testing help and support",
            address: "testing address",
            favIcon: "testing favicon",
            loader: "testing loader",
            companyTiming: "9:00 AM - 6:00 PM"
        }
        return companyData
    }
    async getAndroidAssetLinks() {
        const filePath = path.join(process.cwd(), 'assetlinks.json');
        const raw = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    }



}

module.exports = CompanyController;
