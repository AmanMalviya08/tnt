const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
    question: {
        type: String,
        trim: true
    },
    answer: {
        type: String,
        trim: true
    },
  
    isDisabled: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const faqModel = mongoose.model("Faq", faqSchema);
module.exports = faqModel;