const mongoose = require('mongoose')
const cartItemSchema = new mongoose.Schema({
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package'
    },
    placeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Place'
    },
    quantity:{
        type:Number,
        min:1,
        default:1
    },
    adults: {
        type: Number,
        min:1,
        default: 1
    },
    children: {
        type: Number,
        default: 0
    },
    checkInDate: {
        type: Date,
    },
    selectedAddOns: [
        {
            addOnName: {
                type: String

            },
            price: {
                type: Number

            }
        }
    ]


})
const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    items: {
        type: [cartItemSchema],
        default: []
    }


}, { timestamps: true })

const cartModel = mongoose.model('Cart', cartSchema)
module.exports = cartModel