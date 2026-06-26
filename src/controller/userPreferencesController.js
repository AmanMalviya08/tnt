// FEATURE: Dark Mode / User Preferences | Added: 2026-06-26 | Status: NEW

const { userModel } = require("../models/userModel");
const { SUPPORTED_LANGUAGES } = require("../controller/localeController");

const SUPPORTED_THEMES = ["light", "dark", "system"];

class UserPreferencesController {
  async getPreferences(req, res) {
    try {
      const user = await userModel
        .findById(req.user.userId)
        .select("preferences")
        .lean();

      return res.status(200).json({
        success: true,
        data: {
          theme: user?.preferences?.theme || "system",
          language: user?.preferences?.language || "en",
          supportedThemes: SUPPORTED_THEMES,
          supportedLanguages: SUPPORTED_LANGUAGES,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async updatePreferences(req, res) {
    try {
      const { theme, language } = req.body || {};
      const updates = {};

      if (theme !== undefined) {
        if (!SUPPORTED_THEMES.includes(theme)) {
          return res.status(400).json({
            success: false,
            message: `theme must be one of: ${SUPPORTED_THEMES.join(", ")}`,
          });
        }
        updates["preferences.theme"] = theme;
      }

      if (language !== undefined) {
        if (!SUPPORTED_LANGUAGES.includes(language)) {
          return res.status(400).json({
            success: false,
            message: `language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`,
          });
        }
        updates["preferences.language"] = language;
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({
          success: false,
          message: "Provide at least one of: theme, language",
        });
      }

      const user = await userModel
        .findByIdAndUpdate(req.user.userId, { $set: updates }, { new: true })
        .select("preferences firstName lastName")
        .lean();

      return res.status(200).json({
        success: true,
        message: "Preferences updated",
        data: {
          theme: user.preferences?.theme || "system",
          language: user.preferences?.language || "en",
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = {
  userPreferencesController: new UserPreferencesController(),
  SUPPORTED_THEMES,
};
