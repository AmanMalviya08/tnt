const mongoose = require("mongoose");

const contrySchema = new mongoose.Schema({
  contryName: {
    type: String,
    trim: true,
    required: true,
  },
  image: {
    type: String,
  },
  isDisabled: {
    type: Boolean,
    default: false,
  },
});

contrySchema.index({ contryName: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

const contryModel = mongoose.model("Contry", contrySchema);

module.exports = contryModel;
