const mongoose = require('mongoose');


const contactUsSchema = new mongoose.Schema({
    name: { type: String, trim: true, },
    phone: { type: String, trim: true, },
    email: { type: String, trim: true, },
    message: { type: String, trim: true, },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }


}, { timestamps: true });

module.exports = mongoose.model('contactUs', contactUsSchema);
