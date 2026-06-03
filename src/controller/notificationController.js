const mongoose = require("mongoose");
const { notificationModel } = require("../models/notificationModel");
const { userModel } = require("../models/userModel");
const { sendPushToMany } = require("../services/pushNotificationService");

const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

function toObjectIdIfValid(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function parseTargetFilter(target = "all", role) {
  const normalizedTarget = String(target || "all").toLowerCase();
  if (normalizedTarget === "users") {
    return { role: "Traveler", isDisabled: false };
  }
  if (normalizedTarget === "agents") {
    return { role: "Agent", isDisabled: false };
  }
  if (normalizedTarget === "guides") {
    return { role: "Guide", isDisabled: false };
  }
  if (role) {
    return { role, isDisabled: false };
  }
  return { isDisabled: false };
}

exports.registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { token, platform, appVersion, deviceId } = req.body || {};
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existingIndex = (user.fcmTokens || []).findIndex((item) => item.token === token);
    const payload = {
      token,
      platform: platform || "android",
      appVersion: appVersion || "",
      deviceId: deviceId || "",
      isActive: true,
      lastUsedAt: new Date(),
    };

    if (existingIndex >= 0) {
      user.fcmTokens[existingIndex] = { ...user.fcmTokens[existingIndex].toObject(), ...payload };
    } else {
      user.fcmTokens.push(payload);
    }

    await user.save();
    return res.status(200).json({ success: true, message: "Device token saved" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendAdminNotification = async (req, res) => {
  try {
    const sender = req.user;
    if (!sender || !["Admin", "SubAdmin"].includes(sender.role)) {
      return res.status(403).json({ success: false, message: "Only Admin/SubAdmin can send notifications" });
    }

    const {
      title,
      message,
      type = "admin",
      target = "all",
      role,
      userIds = [],
      imageUrl,
      redirectScreen,
      redirectParams = {},
      meta = {},
    } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    let users = [];
    if (Array.isArray(userIds) && userIds.length > 0) {
      const objectIds = userIds.map(toObjectIdIfValid).filter(Boolean);
      users = await userModel.find({ _id: { $in: objectIds }, isDisabled: false }).select("_id fcmTokens");
    } else {
      const filter = parseTargetFilter(target, role);
      users = await userModel.find(filter).select("_id fcmTokens");
    }

    if (!users.length) {
      return res.status(404).json({ success: false, message: "No target users found" });
    }

    const now = new Date();
    const docs = users.map((user) => ({
      userId: user._id,
      title,
      message,
      type,
      imageUrl,
      redirectScreen,
      redirectParams,
      meta,
      sentBy: sender.userId,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    }));

    await notificationModel.insertMany(docs);

    const allTokens = users.flatMap((user) =>
      (user.fcmTokens || [])
        .filter((entry) => entry?.isActive && entry?.token)
        .map((entry) => entry.token)
    );

    const pushResult = await sendPushToMany(allTokens, {
      title,
      message,
      type,
      redirectScreen,
      redirectParams,
      meta,
    });

    return res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: {
        recipients: users.length,
        push: pushResult,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE, 1);
    const skip = (page - 1) * limit;
    const { type, isRead } = req.query || {};

    const filter = { userId };
    if (type) filter.type = type;
    if (typeof isRead !== "undefined") filter.isRead = String(isRead) === "true";

    const [items, totalItems, unreadCount] = await Promise.all([
      notificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      notificationModel.countDocuments(filter),
      notificationModel.countDocuments({ userId, isRead: false }),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / limit) || 1, 1);
    return res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: items,
      unreadCount,
      pagination: {
        totalItems,
        totalPages,
        pageSize: limit,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const updated = await notificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.status(200).json({ success: true, message: "Notification marked as read", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.userId;
    await notificationModel.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
