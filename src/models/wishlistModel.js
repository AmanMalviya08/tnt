const mongoose = require('mongoose')


const wishlist = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    placeId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Place'

    }],
    packageId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package'

    }],
    tourId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tour'

    }]

}, { timestamps: true })

const wishlistModel = mongoose.model("Wishlist", wishlist);
module.exports = wishlistModel