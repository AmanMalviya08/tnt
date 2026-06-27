const { notificationModel } = require("../models/notificationModel");
const { userModel } = require("../models/userModel");
const { sendPushToMany } = require("./pushNotificationService");

async function getActiveTokens(userId) {
  if (!userId) return [];
  const user = await userModel.findById(userId).select("fcmTokens");
  if (!user) return [];
  return (user.fcmTokens || [])
    .filter((entry) => entry?.isActive && entry?.token)
    .map((entry) => entry.token);
}

async function notifyUser(userId, payload = {}) {
  if (!userId) {
    return { success: false, reason: "missing_user" };
  }

  const {
    title,
    message,
    type = "system",
    redirectScreen,
    redirectParams = {},
    meta = {},
    sentBy,
    imageUrl,
  } = payload;

  if (!title || !message) {
    return { success: false, reason: "missing_content" };
  }

  await notificationModel.create({
    userId,
    title,
    message,
    type,
    imageUrl,
    redirectScreen,
    redirectParams,
    meta,
    sentBy,
    isRead: false,
  });

  const tokens = await getActiveTokens(userId);
  const push = await sendPushToMany(tokens, {
    title,
    message,
    type,
    redirectScreen,
    redirectParams,
    meta,
  });

  if (!tokens.length) {
    console.warn(`[Notify] No active FCM tokens for user ${userId} — saved in-app only.`);
  } else if (push.failed > 0) {
    console.warn(`[Notify] Push partially failed for user ${userId}: sent=${push.sent}, failed=${push.failed}`);
  }

  return { success: true, push, tokenCount: tokens.length };
}

async function notifyAdmins(payload = {}) {
  const admins = await userModel
    .find({ role: { $in: ["Admin", "SubAdmin"] }, isDisabled: { $ne: true } })
    .select("_id")
    .lean();

  const results = await Promise.allSettled(
    admins.map((admin) => notifyUser(admin._id, payload))
  );
  return { notified: results.filter((r) => r.status === "fulfilled").length };
}

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

function formatTravelDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

module.exports = {
  notifyUser,
  notifyAdmins,
  getActiveTokens,
  formatInr,
  formatTravelDate,
};
