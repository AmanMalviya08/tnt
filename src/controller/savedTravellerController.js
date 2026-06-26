const { savedTravellerModel } = require("../models/savedTravellerModel");
const {
  getTravellersFromBookings,
  getCombinedTravellers,
  saveFromBookingPayload,
} = require("../services/savedTravellerService");

class SavedTravellerController {
  async list(req, res) {
    try {
      const userId = req.user.userId;
      const travellers = await savedTravellerModel
        .find({ userId })
        .sort({ isDefault: -1, createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: travellers,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async listFromBookings(req, res) {
    try {
      const userId = req.user.userId;
      const data = await getTravellersFromBookings(userId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async listCombined(req, res) {
    try {
      const userId = req.user.userId;
      const data = await getCombinedTravellers(userId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const userId = req.user.userId;
      const { name, age, gender, relationship, idProofType, idProofNumber, idImageUrl, specialNotes, isDefault } =
        req.body || {};

      if (!name?.trim()) {
        return res.status(400).json({ success: false, message: "name is required" });
      }

      const { traveller, created } = await saveFromBookingPayload(userId, {
        name,
        age,
        gender,
        relationship,
        idProofType,
        idProofNumber,
        idImageUrl,
        specialNotes,
        isDefault,
      });

      return res.status(created ? 201 : 200).json({
        success: true,
        message: created ? "Traveller saved" : "Traveller updated",
        data: traveller,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const updates = { ...(req.body || {}) };
      delete updates.userId;

      if (updates.isDefault) {
        await savedTravellerModel.updateMany({ userId }, { $set: { isDefault: false } });
      }

      const traveller = await savedTravellerModel.findOneAndUpdate(
        { _id: id, userId },
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!traveller) {
        return res.status(404).json({ success: false, message: "Traveller not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Traveller updated",
        data: traveller,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async remove(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const traveller = await savedTravellerModel.findOneAndDelete({ _id: id, userId });
      if (!traveller) {
        return res.status(404).json({ success: false, message: "Traveller not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Traveller removed",
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = {
  savedTravellerController: new SavedTravellerController(),
};
