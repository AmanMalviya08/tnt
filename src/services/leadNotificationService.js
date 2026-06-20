const mongoose = require("mongoose");
const { agentModel } = require("../models/agentModel");
const { notifyUser, formatTravelDate } = require("./notificationDispatchService");

async function resolveAgentUserId(agentRef) {
  if (!agentRef) return null;
  if (mongoose.Types.ObjectId.isValid(agentRef)) {
    const agent = await agentModel.findById(agentRef).select("userId");
    return agent?.userId || null;
  }
  return null;
}

function leadDisplayName(lead) {
  return [lead?.firstName, lead?.lastName].filter(Boolean).join(" ").trim() || "Lead";
}

async function notifyLeadCreated(lead) {
  const userId = (await resolveAgentUserId(lead?.assignedAgent)) || lead?.createdBy;
  if (!userId) return;

  const name = leadDisplayName(lead);
  await notifyUser(userId, {
    title: "New Lead Added",
    message: `Lead ${name} has been added successfully.`,
    type: "system",
    redirectScreen: "ViewLeadDetails",
    redirectParams: { leadId: lead._id?.toString?.(), id: lead._id?.toString?.() },
    meta: { leadId: lead.leadId || lead._id?.toString?.() },
  });
}

async function notifyLeadUpdated(lead, { previousFollowUpDate } = {}) {
  const userId = (await resolveAgentUserId(lead?.assignedAgent)) || lead?.createdBy;
  if (!userId) return;

  const name = leadDisplayName(lead);
  const tasks = [];

  if (lead?.followUpDate) {
    const prev = previousFollowUpDate ? new Date(previousFollowUpDate).getTime() : null;
    const next = new Date(lead.followUpDate).getTime();
    if (!prev || prev !== next) {
      const when = formatTravelDate(lead.followUpDate);
      tasks.push(
        notifyUser(userId, {
          title: "Follow-up Scheduled",
          message: `Follow-up for ${name} is scheduled on ${when}.`,
          type: "system",
          redirectScreen: "ViewLeadDetails",
          redirectParams: { leadId: lead._id?.toString?.(), id: lead._id?.toString?.() },
          meta: { leadId: lead.leadId || lead._id?.toString?.() },
        })
      );
    }
  }

  if (lead?.status === "Won") {
    tasks.push(
      notifyUser(userId, {
        title: "Lead Won",
        message: `${name} has been marked as Won.`,
        type: "reward",
        redirectScreen: "ViewLeadDetails",
        redirectParams: { leadId: lead._id?.toString?.(), id: lead._id?.toString?.() },
      })
    );
  }

  if (!tasks.length) {
    tasks.push(
      notifyUser(userId, {
        title: "Lead Updated",
        message: `Lead ${name} has been updated.`,
        type: "system",
        redirectScreen: "ViewLeadDetails",
        redirectParams: { leadId: lead._id?.toString?.(), id: lead._id?.toString?.() },
      })
    );
  }

  await Promise.allSettled(tasks);
}

module.exports = {
  resolveAgentUserId,
  notifyLeadCreated,
  notifyLeadUpdated,
};
