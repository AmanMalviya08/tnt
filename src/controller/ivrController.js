const { ivrSessionModel } = require("../models/ivrSessionModel");

class IvrController {
  constructor(model = ivrSessionModel) {
    this.model = model;
  }

  async createSession(payload) {
    const session = new this.model(payload);
    return session.save();
  }

  async logEvent(sessionId, eventPayload) {
    const session = await this.model.findById(sessionId);
    if (!session) {
      return null;
    }

    session.events.push({
      action: eventPayload.action,
      prompt: eventPayload.prompt,
      menuOption: eventPayload.menuOption,
      metadata: eventPayload.metadata,
      response: eventPayload.response,
    });

    if (eventPayload.callStatus) {
      session.callStatus = eventPayload.callStatus;
      if (eventPayload.callStatus === "Completed" && !session.endTime) {
        session.endTime = new Date();
      }
    }

    await session.save();
    return session;
  }

  async getSessions(filter = {}, options = {}) {
    const query = this.model
      .find(filter)
      .populate("bookingId")
      .populate("leadId")
      .populate("assignedAgent", "firstName lastName email phone");

    if (options.sort) {
      query.sort(options.sort);
    }

    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (!Number.isNaN(limit)) {
        query.limit(limit);
      }
    }

    if (options.page && options.limit) {
      const page = Math.max(parseInt(options.page, 10), 1);
      const limit = parseInt(options.limit, 10);
      if (!Number.isNaN(page) && !Number.isNaN(limit)) {
        query.skip((page - 1) * limit);
      }
    }

    return query;
  }

  async getSessionById(id) {
    return this.model
      .findById(id)
      .populate("bookingId")
      .populate("leadId")
      .populate("assignedAgent", "firstName lastName email phone");
  }

  async updateSession(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  }

  async deleteSession(id) {
    return this.model.findByIdAndDelete(id);
  }
}

module.exports = IvrController;
