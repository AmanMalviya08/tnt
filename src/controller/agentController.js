const { agentModel } = require("../models/agentModel");
const { userModel } = require("../models/userModel");
const Transaction = require("../models/transactionModel");

class AgentController {
  constructor(model = agentModel) {
    this.model = model;
  }

  async createAgent(payload) {
    const { email, phone } = payload;

    const exists = await this.model.findOne({
      $or: [{ email }, { phone }],
    });

    if (exists) {
      throw new Error("Email or phone already exists");
    }

    // Check if User exists
    let user = await userModel.findOne({
      $or: [{ email }, { phone }],
    });
    if (user && user.role != 'Agent') {
      throw new Error("Different type of user already exists with this email or phone");
    }

    if (!user) {
      // Create new User
      const randomPassword = Math.random().toString(36).slice(-8); // Random password
      user = await userModel.create({
        firstName: payload.firstName || "Agent",
        lastName: payload.lastName || "User",
        email: email,
        phone: phone,
        role: "Agent",
        password: randomPassword,
        status: "Active",
        isEmailVerified: true,
        isPhoneVerified: true
      });
    }

    // Add userId to payload
    payload.userId = user._id;
    console.log(user, "user")
    console.log(payload, "payload")
    const agent = new this.model(payload);
    if (payload.createdBy) {
      agent.createdBy = payload.createdBy;
    }
    await agent.save();

    if (agent && agent.userId) {
      const userUpdatePayload = {};
      const commonFields = [
        "firstName",
        "lastName",
        "avatarUrl"
      ];

      commonFields.forEach((field) => {
        if (payload[field] !== undefined) {
          userUpdatePayload[field] = payload[field];
        }
      });

      if (Object.keys(userUpdatePayload).length > 0) {
        // Update the user model
        await userModel.findByIdAndUpdate(agent.userId, userUpdatePayload, {
          new: true,
          runValidators: true,
        });
      }
    }

    return agent



  }

  async getAgents(filter = {}, options = {}) {
    let finalFilter = { ...filter };

    if (options.search) {
      const searchRegex = new RegExp(options.search, 'i');
      const searchFilter = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      };

      if (Object.keys(finalFilter).length > 0) {
        finalFilter = { $and: [finalFilter, searchFilter] };
      } else {
        finalFilter = searchFilter;
      }
    }
    const query = this.model.find(finalFilter).populate({
      path: 'createdBy',
      select: 'firstName lastName role'
    });

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

    const agents = await query.exec();


    const agentUserIds = agents.map(agent => agent.userId).filter(id => id);

    const transferTotals = await Transaction.aggregate([
      {
        $match: {
          userId: { $in: agentUserIds },
          category: "Transfer",
          type: "Credit",
          status: "Approved",
          distributorId: { $exists: true }
        }
      },
      {
        $group: {
          _id: "$userId",
          total: { $sum: "$amount" }
        }
      }
    ]);

    const totalMap = transferTotals.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.total;
      return acc;
    }, {});

    const agentsWithTotals = agents.map(agent => {
      const agentObj = agent.toObject();
      agentObj.totalMoneyFromDistributor = totalMap[agent.userId?.toString()] || 0;
      return agentObj;
    });

    return agentsWithTotals;
  }

  async getAgentById(id) {
    return this.model.findById(id);
  }

  async updateAgent(id, payload) {
    // Find the agent to get the userId
    const agent = await this.model.findById(id);

    if (agent && agent.userId) {
      const userUpdatePayload = {};
      const commonFields = [
        "firstName",
        "lastName",
        "profileImage"
      ];

      commonFields.forEach((field) => {
        if (payload[field] !== undefined) {
          if (field === "profileImage") {
            userUpdatePayload["avatarUrl"] = payload[field];
          } else {

            userUpdatePayload[field] = payload[field];
          }
        }
      });

      if (Object.keys(userUpdatePayload).length > 0) {
        // Update the user model
        await userModel.findByIdAndUpdate(agent.userId, userUpdatePayload, {
          new: true,
          runValidators: true,
        });
      }
    }

    return this.model.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
  }

  async changeStatus(id, payload, requester = {}) {
    const agent = await this.model.findById(id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Authorization Check
    if (requester.role === 'Distributor' && agent.createdBy.toString() !== requester.userId.toString()) {
      throw new Error("Forbidden: You can only manage agents you created.");
    }

    console.log(agent, id);
    return this.model.findByIdAndUpdate(
      id,
      {
        $set: payload,
      },
      { new: true, runValidators: true }
    );
  }

  async markAgentAsPaid(id, isPaid) {
    const agent = await this.model.findById(id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    return this.model.findByIdAndUpdate(
      id,
      { isPaid: isPaid },
      { new: true }
    );
  }

  async deleteAgent(id, requester = {}) {
    const agent = await this.model.findById(id);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Authorization Check
    if (requester.role === 'Distributor' && agent?.createdBy?.toString() !== requester?.userId?.toString()) {
      throw new Error("Forbidden: You can only delete agents you created.");
    }

    return this.model.findByIdAndDelete(id);
  }
}

module.exports = AgentController;
