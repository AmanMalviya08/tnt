const mongoose = require("mongoose");

const stateSchema = new mongoose.Schema({
  stateName: {
    type: String,
    trim: true,
  },
  countryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contry",
  },
  image: {
    type: String,
  },
  isDisabled: {
    type: Boolean,
    default: false,
  },
});

const stateModel = mongoose.model("State", stateSchema);

module.exports = stateModel;
