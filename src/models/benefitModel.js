const mongoose = require("mongoose");

const benefitSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        points: [
            {
                type: String,
                trim: true,
            },
        ],
        icon: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isDisabled: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const BenefitModel = mongoose.model("Benefit", benefitSchema);

module.exports = BenefitModel;
