const cron = require("node-cron");
const { leadModel } = require("../models/leadModel");
const { bookingModel } = require("../models/bookingModel");
const { notificationModel } = require("../models/notificationModel");
const { notifyUser, formatTravelDate } = require("./notificationDispatchService");
const { resolveAgentUserId } = require("./leadNotificationService");

function getDayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function wasReminderSentToday(userId, reminderKey) {
  const { start } = getDayBounds();
  const existing = await notificationModel.findOne({
    userId,
    "meta.reminderKey": reminderKey,
    createdAt: { $gte: start },
  }).select("_id");
  return Boolean(existing);
}

async function sendTodaysLeadFollowUpReminders() {
  const { start, end } = getDayBounds();
  const today = dayKey();

  const leads = await leadModel.find({
    followUpDate: { $gte: start, $lte: end },
    status: { $in: ["Follow Up", "Contacted", "Qualified", "New"] },
    isDisabled: { $ne: true },
  });

  let sent = 0;
  for (const lead of leads) {
    const userId = (await resolveAgentUserId(lead.assignedAgent)) || lead.createdBy;
    if (!userId) continue;

    const reminderKey = `lead-followup-${lead._id}-${today}`;
    if (await wasReminderSentToday(userId, reminderKey)) continue;

    const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || "your lead";
    const timeLabel = lead.followUpDate
      ? new Date(lead.followUpDate).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "today";

    await notifyUser(userId, {
      title: "Today's Follow-up",
      message: `Follow up with ${name} at ${timeLabel}.`,
      type: "system",
      redirectScreen: "ViewLeadDetails",
      redirectParams: { leadId: lead._id?.toString?.(), id: lead._id?.toString?.() },
      meta: { reminderKey, leadId: lead.leadId || lead._id?.toString?.() },
    });
    sent += 1;
  }

  if (sent > 0) {
    console.log(`[Notification Scheduler] Sent ${sent} lead follow-up reminder(s).`);
  }
}

async function sendTodaysTripReminders() {
  const { start, end } = getDayBounds();
  const today = dayKey();

  const bookings = await bookingModel.find({
    travelStartDate: { $gte: start, $lte: end },
    paymentStatus: "Paid",
  });

  let sent = 0;
  for (const booking of bookings) {
    const userId = booking.assignedAgent;
    if (!userId) continue;

    const reminderKey = `booking-trip-${booking._id}-${today}`;
    if (await wasReminderSentToday(userId, reminderKey)) continue;

    const bookingRef = booking.bookingId || booking._id;
    const travelDate = formatTravelDate(booking.travelStartDate);

    await notifyUser(userId, {
      title: "Trip Today",
      message: `Booking ${bookingRef} for ${booking.customerName || "customer"} is scheduled ${travelDate ? `on ${travelDate}` : "today"}.`,
      type: "tour",
      redirectScreen: "ViewDetails",
      redirectParams: { bookingId: bookingRef, id: booking._id?.toString?.() },
      meta: { reminderKey, bookingId: bookingRef },
    });
    sent += 1;
  }

  if (sent > 0) {
    console.log(`[Notification Scheduler] Sent ${sent} trip reminder(s).`);
  }
}

async function runDailyReminders() {
  try {
    await sendTodaysLeadFollowUpReminders();
    await sendTodaysTripReminders();
  } catch (error) {
    console.error("[Notification Scheduler] Error:", error.message);
  }
}

function initNotificationScheduler() {
  // 8:00 AM every day (server local time)
  cron.schedule("0 8 * * *", runDailyReminders);
  // Also run once shortly after server start
  setTimeout(runDailyReminders, 15000);
  console.log("[Notification Scheduler] Initialized daily follow-up & trip reminders");
}

module.exports = {
  initNotificationScheduler,
  runDailyReminders,
};
