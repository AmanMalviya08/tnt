const mongoose = require('mongoose');
const heroSectionSchema = new mongoose.Schema({
  backgroundImage: {
    type: String,
    trim:true,
    default: '/images/hero-beach.jpg'
  },
  title: {
    type: String,
    trim:true,
    default: 'About Us'
  },
//   breadcrumb: [{
//     label: String,
//     link: String
//   }]
});

const mainContentSchema = new mongoose.Schema({
  images: [{
    url: String,
    alt: String
  }],
  badge: {
    text: String,
    subText: String
  },
  heading: {
    type: String,
    trim:true
  },
  description: {
    type: String,
    trim:true
  },
  ctaButton: {
    text: String,
    link: String
  }
});

const featureCardSchema = new mongoose.Schema({
  icon: {
    type: String,
    trim:true
  },
  title: {
    type: String,
    trim:true
  },
  description: {
    type: String,
    trim:true
  },
  order: {
    type: Number,
    default: 0
  }
});

const whatWeDoSchema = new mongoose.Schema({
  sectionTitle: {
    type: String,
    default: 'What We Do'
  },
  heading: {
    type: String,
    trim:true
  },
  description: {
    type: String,
    trim:true
  },
  features: [featureCardSchema]
});

const popularDestinationsSchema = new mongoose.Schema({
  backgroundImage: {
    type: String,
    trim:true
  },
  sectionTitle: {
    type: String,
    default: 'Next Adventure Destination'
  },
  heading: {
    type: String,
    trim:true
  },
  ctaButton: {
    text: String,
    link: String
  }
});

const footerInfoSchema = new mongoose.Schema({
  address: {
    type: String,
    trim:true
  },
  phone: {
    type: String,
    trim:true
  },
  openingHours: [{
    day: String,
    hours: String
  }],
  quickLinks: [{
    label: String,
    link: String
  }]
});

const aboutUsPageSchema = new mongoose.Schema({
  pageName: {
    type: String,
    default: 'About Us',
  },
  isActive: {
    type: Boolean,
    default: true
  },
  heroSection: {
    type: heroSectionSchema,
  },
  mainContent: {
    type: mainContentSchema,
  },
  whatWeDo: {
    type: whatWeDoSchema,
  },
  popularDestinations: {
    type: popularDestinationsSchema,
  },
  footerInfo: {
    type: footerInfoSchema,
  },
  seoMeta: {
    title: String,
    description: String,
    keywords: [String]
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// aboutUsPageSchema.pre('save', function(next) {
//   this.lastUpdated = Date.now();
//   next();
// });

const AboutUsModel = mongoose.model('AboutUsPage', aboutUsPageSchema);

module.exports = AboutUsModel;
 