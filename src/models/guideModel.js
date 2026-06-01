const mongoose = require('mongoose');

const guideSchema = new mongoose.Schema({

    registrationNumber: {
        type: String,
        trim: true
    },
    fullName: {
        type: String,
        trim: true
    },
    gender:{
        type:String,
        enum:['Male','Female','Other'],
        default:'Other'
    },
    email: {
        type: String,
        lowercase: true,
        trim: true,
    },
    dob: {
        type: Date
    },
    nationality: {
        type: String
    },
    phone: {
        type: String,
        trim: true
    },
    profileImage: {
        type: String,
        default: null
    },
    idProof: {
        type: String,
        trim: true
    },

    licenseNumber: {
        type: String,
        trim: true
    },
    languages: [{
        type: String,
        trim: true
    }],
    specializations: [{
        type: String,
        trim: true
    }],
    experience: {
        type: Number,
        default: 0,
    },
    certification: [{
        name: String,
        issuedBy: String,
        issuedDate: Date,
        expiryDate: Date,
        documentUrl: String
    }],

    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Suspended', 'Pending'],
        default: 'Pending'
    },
    // isVerified: {
    //     type: Boolean,
    //     default: false
    // },
    verificationDate: {
        type: Date,
        default: null
    },

    // Performance Metrics
    performance: {
        totalToursCompleted: {
            type: Number,
            default: 0
        },
        totalToursAssigned: {
            type: Number,
            default: 0
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        totalReviews: {
            type: Number,
            default: 0
        },
        completionRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        onTimePercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    },

    // Ratings and Feedback
    // ratings: [{
    //     userId: {
    //         type: mongoose.Schema.Types.ObjectId,
    //         ref: 'User'
    //     },
    //     tourId: {
    //         type: mongoose.Schema.Types.ObjectId,
    //         ref: 'Tour'
    //     },
    //     rating: {
    //         type: Number,
    //         required: true,
    //         min: 1,
    //         max: 5
    //     },
    //     review: {
    //         type: String,
    //         trim: true
    //     },
    //     createdAt: {
    //         type: Date,
    //         default: Date.now
    //     }
    // }],

    ratings: {
        averageRating: { type: Number, default: 1 },
        totalReviews: { type: Number, default: 0 }
    },

    complaints: [{

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        tourId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tour'
        },
        subject: {
            type: String,
            trim: true
        },
        description: {
            type: String,
        },
        type: {
            type: String,
            enum: ['Behavior', 'Misinformation', 'Lateness', 'Unprofessionalism', 'Other'],
            default: 'Other'
        },
        status: {
            type: String,
            enum: ['Pending', 'Investigating', 'Resolved', 'Dismissed'],
            default: 'Pending'
        },
        severity: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Critical'],
            default: 'Medium'
        },
        filedAt: {
            type: Date,
            default: Date.now
        },
        resolvedAt: {
            type: Date,
            default: null
        },
        resolution: {
            type: String,
            default: null
        }
    }],

    availability: {
        monday: { type: Boolean, default: true },
        tuesday: { type: Boolean, default: true },
        wednesday: { type: Boolean, default: true },
        thursday: { type: Boolean, default: true },
        friday: { type: Boolean, default: true },
        saturday: { type: Boolean, default: true },
        sunday: { type: Boolean, default: true }
    },
    preferredLocations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Place'

    }],
    preferredTourType: {
        type: String,
        enum: ["Group", "Private", "Both"],
        default: 'Both'
    },
    timeAvailability: {
        type: String,
        trim: true
    },
    paymentTerms: {
        type: String,
        trim: true
    },
    bio: {
        type: String,
        trim: true,

    },
    address: {
        type: String,
        trim: true
    },
    emergencyContact: {
        type: String,
        trim: true
    },

    bankDetails: {
        accountNumber: String,
        bankName: String,
        ifscCode: String,
        accountHolderName: String
    },
    upiId: {
        type: String,
        trim: true
    },
    ratePerHour: {
        type: Number,
        default: 0,
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
// guideSchema.index({ email: 1 });
// guideSchema.index({ licenseNumber: 1 });
// guideSchema.index({ status: 1 });
// guideSchema.index({ 'performance.averageRating': -1 });

// Virtual for full name
// guideSchema.virtual('fullName').get(function() {
//   return `${this.firstName} ${this.lastName}`;
// });

// Virtual for active complaints count
// guideSchema.virtual('activeComplaintsCount').get(function() {
//   return this.complaints.filter(c => c.status === 'pending' || c.status === 'investigating').length;
// });

// Method to calculate average rating
// guideSchema.methods.calculateAverageRating = function () {
//     if (this.ratings.length === 0) return 0;
//     const sum = this.ratings.reduce((acc, curr) => acc + curr.rating, 0);
//     return (sum / this.ratings.length).toFixed(2);
// };

// // Method to update performance metrics
// guideSchema.methods.updatePerformance = async function (toursData) {
//     this.performance.totalReviews = this.ratings.length;
//     this.performance.averageRating = this.calculateAverageRating();

//     // Tours data should be passed from the TourAllocation model
//     if (toursData) {
//         this.performance.totalToursCompleted = toursData.completedTours || 0;
//         this.performance.totalToursAssigned = toursData.totalTours || 0;

//         if (toursData.totalTours > 0) {
//             this.performance.completionRate = ((toursData.completedTours / toursData.totalTours) * 100).toFixed(2);
//         }

//         if (toursData.onTimePercentage !== undefined) {
//             this.performance.onTimePercentage = toursData.onTimePercentage;
//         }
//     }

//     await this.save();
// };

// // Pre-save middleware to update average rating
// guideSchema.pre('save', function (next) {
//     // if (this.isModified('ratings')) {
//     //     this.performance.averageRating = this.calculateAverageRating();
//     //     this.performance.totalReviews = this.ratings.length;
//     // }
//     next();
// });

const Guide = mongoose.model('Guide', guideSchema);

module.exports = Guide;