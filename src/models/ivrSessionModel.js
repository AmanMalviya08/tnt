const mongoose = require("mongoose");

const ivrCallStatuses = ["Initiated", "Ringing", "Answered", "No Answer", "Completed", "Failed"];
const ivrActions = ["PlayMessage", "GatherInput", "ConnectAgent", "Voicemail", "EndCall"];

const ivrEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ivrActions,
    },
    prompt: {
      type: String,
      trim: true,
    },
    menuOption: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
    response: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const ivrSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      trim: true,
      unique: true,
    },
    provider: {
      type: String,
      trim: true,
    },
    callStatus: {
      type: String,
      enum: ivrCallStatuses,
      default: "Initiated",
    },
    callerNumber: {
      type: String,
      trim: true,
      required: true,
    },
    destinationNumber: {
      type: String,
      trim: true,
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
    },
    events: {
      type: [ivrEventSchema],
      default: [],
    },
    recordingUrl: {
      type: String,
      trim: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

function generateSessionId() {
  return `IVR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

ivrSessionSchema.pre("save", async function (next) {
  try {
    if (!this.sessionId) {
      const Model = this.constructor;
      let candidate = generateSessionId();
      while (await Model.exists({ sessionId: candidate })) {
        candidate = generateSessionId();
      }
      this.sessionId = candidate;
    }

    if (this.callStatus === "Completed" && !this.endTime) {
      this.endTime = new Date();
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

ivrSessionSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    const payload = update.$set ? update.$set : update;

    if (payload.callStatus === "Completed" && !payload.endTime) {
      const newDate = new Date();
      if (update.$set) {
        update.$set.endTime = newDate;
      } else {
        update.endTime = newDate;
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

const ivrSessionModel = mongoose.model("IvrSession", ivrSessionSchema);

module.exports = {
  ivrSessionModel,
  ivrCallStatuses,
  ivrActions,
};
