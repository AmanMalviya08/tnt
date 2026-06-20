const { userModel } = require("../models/userModel");

const SUPPORTED_LANGUAGES = ["en", "hi", "mr", "gu"];

class LocaleController {
  async getLanguagePreference(req, res) {
    try {
      const user = await userModel
        .findById(req.user.userId)
        .select("preferences.language")
        .lean();

      return res.status(200).json({
        success: true,
        data: {
          language: user?.preferences?.language || "en",
          supportedLanguages: SUPPORTED_LANGUAGES,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateLanguagePreference(req, res) {
    try {
      const { language } = req.body;
      if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
        return res.status(400).json({
          success: false,
          message: `Language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`,
        });
      }

      const user = await userModel.findByIdAndUpdate(
        req.user.userId,
        { $set: { "preferences.language": language } },
        { new: true }
      ).select("preferences.language firstName lastName");

      return res.status(200).json({
        success: true,
        message: "Language preference updated",
        data: {
          language: user.preferences.language,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = {
  localeController: new LocaleController(),
  SUPPORTED_LANGUAGES,
};
