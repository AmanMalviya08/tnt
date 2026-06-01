const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { userModel } = require("../models/userModel");
const { bookingModel } = require("../models/bookingModel");
const Transaction = require("../models/transactionModel");
const {
  generateNumericOtp,
  getExpiryDate,
  sendOtpViaMSG91,
} = require("../utils/otpHelper");

const OTP_SALT_ROUNDS = parseInt(
  process.env.PHONE_OTP_SALT_ROUNDS || process.env.BCRYPT_SALT_ROUNDS || "10",
  10,
);
const roles = ["Admin", "SubAdmin", "Agent", "Traveler", "Guest"];
const MAX_OTP_ATTEMPTS = parseInt(
  process.env.PHONE_OTP_MAX_ATTEMPTS || "10",
  10,
);
const JWT_SECRET = process.env.JWT_SECRET || "set-a-secure-jwt-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

class UserController {
  constructor(model = userModel) {
    this.model = model;
  }

  async registerUser(payload = {}) {
    const { phone, email } = payload;
    const query = [];
    if (phone) {
      query.push({ phone });
    }
    if (email) {
      query.push({ email });
    }

    let user;
    if (query.length) {
      user = await this.model.findOne({ $or: query }).select("+password");
    }

    if (user) {
      const updatableFields = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "avatarUrl",
        "bio",
        "preferences",
        "role",
        "status",
      ];

      updatableFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) {
          user[field] = payload[field];
        }
      });

      if (payload.password) {
        user.password = payload.password;
      }
      if (payload.address) {
        user.address = {
          ...user.address,
          ...payload.address,
        };
      }

      await user.save();
      return user;
    }

    const newUser = new this.model(payload);
    return newUser.save();
  }

  async registerAdmin(payload = {}) {
    const { email, password } = payload;

    const existingAdmin = await this.model.findOne({
      email: email.toLowerCase(),
    });
    if (existingAdmin) {
      throw new Error("admin already exist");
    }

    // const saltRounds = 12;
    // const hashedPassword = await bcrypt.hash(password, saltRounds);
    // console.log(password)
    const newAdmin = await this.model.create({
      email: email.toLowerCase(),
      password,
      role: "Admin",
    });
    const tokenPayload = {
      userId: newAdmin._id,
      role: newAdmin.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET);

    return {
      userId: newAdmin._id,
      email: newAdmin.email,
      token,
    };
  }

  async createDistributor(payload = {}) {
    const { email, password, firstName, lastName, phone, distributorCommission, paidAgentCommission, bankDetails, upiId, creditMoney, agentAmount } = payload;

    const existingUser = await this.model.findOne({
      email: email.toLowerCase(),
    });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const newDistributor = await this.model.create({
      email: email.toLowerCase(),
      password,
      role: "Distributor",
      firstName,
      lastName,
      phone,
      status: "Active",
      isEmailVerified: true,
      distributorCommission: distributorCommission || 0,
      paidAgentCommission: paidAgentCommission || 0,
      permissions: payload.permissions || [],
      bankDetails,
      upiId,
      agentAmount: agentAmount || 0,
      credit_money: creditMoney || 0
    });

    return {
      userId: newDistributor._id,
      email: newDistributor.email,
      role: newDistributor.role,
      distributorCommission: newDistributor.distributorCommission,
      paidAgentCommission: newDistributor.paidAgentCommission,
      agentAmount: newDistributor.agentAmount,
    };
  }

  async createSubAdmin(payload = {}) {
    const { email, password, permissions = [], firstName, lastName, phone, bankDetails, upiId } = payload;

    const existingUser = await this.model.findOne({
      email: email.toLowerCase(),
    });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const newSubAdmin = await this.model.create({
      email: email.toLowerCase(),
      password,
      role: "SubAdmin",
      permissions,
      firstName,
      lastName,
      phone,
      status: "Active",
      isEmailVerified: true,
      bankDetails,
      upiId,
      isEmailVerified: true // Assuming created by Admin is verified
    });

    const tokenPayload = {
      userId: newSubAdmin._id,
      role: newSubAdmin.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET);

    return {
      userId: newSubAdmin._id,
      email: newSubAdmin.email,
      role: newSubAdmin.role,
      permissions: newSubAdmin.permissions,
      token,
    };
  }

  async updateSubAdmin(id, payload = {}) {
    const { email, password, permissions, firstName, lastName, phone, status } = payload;

    const user = await this.model.findOne({ _id: id, role: "SubAdmin" });
    if (!user) {
      throw new Error("SubAdmin not found");
    }

    if (email) {
      const emailLower = email.toLowerCase();
      const existingUser = await this.model.findOne({
        email: emailLower,
        _id: { $ne: id },
      });
      if (existingUser) {
        throw new Error("Email already in use by another user");
      }
      user.email = emailLower;
    }

    if (password) {
      user.password = password;
    }

    if (permissions !== undefined) user.permissions = permissions;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (status !== undefined) user.status = status;

    return await user.save();
  }


  async getAllDistributors(options = {}) {
    const { page, limit, sort, search } = options;
    const query = { role: "Distributor" };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const pageSize =
      !Number.isNaN(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : DEFAULT_PAGE_SIZE;
    const currentPage =
      !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const dbQuery = this.model.find(query).select("-password");

    const sortBy = sort || { createdAt: -1 };
    dbQuery.sort(sortBy);

    dbQuery.skip((currentPage - 1) * pageSize).limit(pageSize);

    const [items, totalItems] = await Promise.all([
      dbQuery.exec(),
      this.model.countDocuments(query),
    ]);

    // Calculate total money received from admin for each distributor
    // A distributor receives money from admin (distributorId is not present in transaction)
    const distributorIds = items.map(distributor => distributor._id);

    const transferTotals = await Transaction.aggregate([
      {
        $match: {
          userId: { $in: distributorIds },
          category: "Transfer",
          type: "Credit",
          status: "Approved",
          distributorId: { $exists: false }
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

    const distributorsWithTotals = items.map(distributor => ({
      ...distributor.toObject(),
      totalMoneyFromAdmin: totalMap[distributor._id.toString()] || 0
    }));

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: distributorsWithTotals,
      pagination: {
        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async getAllSubAdmins(options = {}) {
    const { page, limit, sort, search } = options;
    const query = { role: "SubAdmin" };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const pageSize =
      !Number.isNaN(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : DEFAULT_PAGE_SIZE;
    const currentPage =
      !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;


    const dbQuery = this.model.find(query).select("-password");
    console.log("herer")
    const sortBy = sort || { createdAt: -1 };
    dbQuery.sort(sortBy);

    dbQuery.skip((currentPage - 1) * pageSize).limit(pageSize);

    const [items, totalItems] = await Promise.all([
      dbQuery.exec(),
      this.model.countDocuments(query),
    ]);
    console.log(items)

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: items,
      pagination: {
        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async loginAdmin(payload = {}) {
    const { email, password } = payload;

    const admin = await this.model
      .findOne({
        email: email.toLowerCase(),
      })
      .select("+password");

    if (!admin) {
      throw new Error("Invalid credentials");
    }

    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      throw new Error("invalid credentials");
    }

    if (admin.isDisabled === true) {
      throw new Error("account has been deactivated");
    }

    // Allow SubAdmin to login as well
    if (admin.role !== 'Admin' && admin.role !== 'SubAdmin' && admin.role !== 'Distributor') {
      throw new Error("Unauthorized access");
    }

    const tokenPayload = {
      userId: admin._id,
      role: admin.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET);
    console.log(token, JWT_SECRET)

    return {
      userId: admin._id,
      name: admin.firstName, // Changed from admin.name to admin.firstName as name is virtual or not directly stored like this usually
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      token,
    };
  }

  async getUsers(filter = {}, options = {}) {
    const normalizedFilter = { ...filter, role: "Traveler" };

    // Handle search across firstName, lastName, email, phone
    if (options.search) {
      const searchRegex = new RegExp(options.search, 'i');
      normalizedFilter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "isDisabled")) {
      const raw = normalizedFilter.isDisabled;
      if (typeof raw === "string") {
        normalizedFilter.isDisabled = raw === "true";
      }
    }

    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize =
      !Number.isNaN(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : DEFAULT_PAGE_SIZE;
    const currentPage =
      !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const query = this.model.find(normalizedFilter).select("-password");

    const sort = options.sort || { createdAt: -1 };
    query.sort(sort);

    query.skip((currentPage - 1) * pageSize).limit(pageSize);

    const [items, totalItems] = await Promise.all([
      query.exec(),
      this.model.countDocuments(normalizedFilter),
    ]);

    const userIds = items.map((user) => user._id);

    const bookingCounts = await bookingModel.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);

    const bookingCountMap = bookingCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const usersWithBookings = items.map((user) => ({
      ...user.toObject(),
      totalBookings: bookingCountMap[user._id.toString()] || 0,
    }));

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: usersWithBookings,
      pagination: {
        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async getUserById(id) {
    return this.model.findById(id).select("-password").populate("agents");
  }

  async updateUser(id, payload) {
    if (payload.password === "") {
      delete payload.password;
    }

    console.log(payload)

    const { email } = payload;
    if (email) {
      const existingUser = await this.model.findOne({
        email,
        _id: { $ne: id },
      });

      if (existingUser) {
        throw new Error("Email already in use by another user");
      }
    }

    const updateQuery = { ...payload };
    let finalQuery = updateQuery;

    if (updateQuery.creditMoney) {
      const creditAmount = Number(updateQuery.creditMoney);
      delete updateQuery.creditMoney;

      const user = await this.model.findById(id);
      const updateField = user && user.role === 'Distributor' ? 'credit_money' : 'wallet';

      finalQuery = { $inc: { [updateField]: creditAmount } };
      if (Object.keys(updateQuery).length > 0) {
        finalQuery.$set = updateQuery;
      }
    }

    return this.model
      .findByIdAndUpdate(id, finalQuery, {
        new: true,
        runValidators: true,
      })
      .select("-password");
  }

  async deleteUser(id) {
    return this.model.findByIdAndDelete(id);
  }

  async setUserDisabled(id, options = {}) {
    const existing = await this.model.findById(id).select("isDisabled");
    if (!existing) {
      return null;
    }

    let { updatedBy } = options;
    let isDisabled = !existing.isDisabled;

    if (typeof isDisabled === "undefined") {
      isDisabled = !existing.isDisabled;
    } else {
      isDisabled = Boolean(isDisabled);
    }

    const update = {
      isDisabled,
    };

    if (updatedBy) {
      update.updatedBy = updatedBy;
    }

    return this.model
      .findByIdAndUpdate(
        id,
        {
          $set: update,
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .select("-password");
  }

  async sendPhoneOtpByPhone(payload = {}) {
    const { phone, firstName, lastName, email, role } = payload;

    if (!roles.includes(role)) {
      throw new Error("Please select the role");
    }
    if (!phone) {
      throw new Error("Phone number is required to send OTP");
    }

    let user = await this.model.findOne({ phone }).select("+phoneOtp.codeHash");
    if (user && user.role !== role && user.isPhoneVerified) {
      throw new Error(
        `this number is login as ${user.role} please choose the ${user.role} `,
      );
    }
    if (user && user.role === 'Distributor') {
      throw new Error(
        `this number is login as ${user.role} please use different number `,
      );
    }
    let created = false;

    if (!user) {
      const randomPassword = crypto.randomBytes(12).toString("hex");
      user = new this.model({
        phone,
        firstName: firstName || "Guest",
        lastName,
        email,
        role,
        password: randomPassword,
      });
      created = true;
    } else {
      if (firstName) {
        user.firstName = firstName;
      }
      if (lastName) {
        user.lastName = lastName;
      }
      if (email) {
        user.email = email;
      }
      if (role) {
        user.role = role;
      }
    }
    const now = new Date();
    if (user.phoneOtp?.lastSentAt) {
      const timeSinceLastOtp = now - new Date(user.phoneOtp.lastSentAt);
      const cooldownPeriod = 60 * 1000;

      if (timeSinceLastOtp < cooldownPeriod) {
        const waitTime = Math.ceil((cooldownPeriod - timeSinceLastOtp) / 1000);
        throw new Error(
          `Please wait ${waitTime} seconds before requesting another OTP`,
        );
      }
    }
    if (user.phoneOtp?.attempts >= MAX_OTP_ATTEMPTS) {
      const lastAttemptDate = new Date(user.phoneOtp.lastSentAt);
      const hoursSinceLastAttempt = (now - lastAttemptDate) / (1000 * 60 * 60);

      if (hoursSinceLastAttempt < 24) {
        throw new Error(
          `Daily OTP limit reached. Please try again after 24 hours`,
        );
      } else {
        user.phoneOtp.attempts = 0;
      }
    }

    const otp = generateNumericOtp();
    console.log(otp);
    const sendOtp = await sendOtpViaMSG91(phone, otp);
    // const sendOtp = await sendOtpViaMSG91(phone);
    const expiresAt = getExpiryDate();
    console.log("OTP Response:", sendOtp);

    if (sendOtp?.type == "success") {
      const hashedOtp = await bcrypt.hash(otp, OTP_SALT_ROUNDS);
      const attempts = user?.phoneOtp?.attempts || 1;
      user.phoneOtp = {
        codeHash: hashedOtp,
        expiresAt,
        attempts: attempts + 1,
        lastSentAt: new Date(),
      };
      user.isPhoneVerified = false;
      await user.save();
    } else {
      throw new Error(`failed to send otp`);
    }

    const needsProfileUpdate =
      !user.firstName || user.firstName === "Guest" || !user.email;

    return {
      userId: user.id,
      phone: user.phone,
      role,
      expiresAt,
      created,
      needsProfileUpdate,
    };
  }

  async verifyPhoneOtpByPhone(payload = {}) {
    const { phone, otp: otpCode } = payload;
    if (!phone) {
      throw new Error("Phone number is required to verify OTP");
    }

    const user = await this.model
      .findOne({ phone })
      .select("+phoneOtp.codeHash")
      .populate("agents");
    if (!user) {
      return null;
    }

    if (!user.phoneOtp || !user.phoneOtp.codeHash) {
      throw new Error("No OTP is pending verification for this user");
    }

    const { codeHash, expiresAt, attempts = 0 } = user.phoneOtp;

    // if (attempts >= MAX_OTP_ATTEMPTS) {
    //   throw new Error("Maximum OTP attempts exceeded. Please request a new OTP");
    // }

    if (expiresAt && expiresAt < new Date()) {
      throw new Error("OTP has expired. Please request a new OTP");
    }

    const normalizedOtp = String(otpCode || "").trim();
    if (!normalizedOtp) {
      throw new Error("OTP is required");
    }

    if (!codeHash) {
      throw new Error("No OTP hash found. Please request a new OTP");
    }

    const isMatch = await bcrypt.compare(normalizedOtp, codeHash);

    if (!isMatch) {
      user.phoneOtp.attempts = attempts + 1;
      await user.save();
      throw new Error("Invalid OTP. Please try again");
    }

    user.isPhoneVerified = true;
    user.phoneOtp = undefined;
    await user.save();
    console.log(user, "user")
    let shouldCompleteProfile = true;
    let isVerified = false;
    if (user.role === "Agent") {
      if (user?.agents) {
        shouldCompleteProfile = false;
      }
      if (user?.agents?.verificationStatus === "Verified") {
        isVerified = true;
      }
    } else {
      shouldCompleteProfile =
        !user.firstName || user.firstName === "Guest" || !user.email;
    }
    console.log(user)
    const tokenPayload = {
      userId: user.id,
      role: user.role,
      phone: user.phone,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return {
      userId: user.id,
      phone: user.phone,
      verified: true,
      role: user.role,
      needsProfileUpdate: shouldCompleteProfile,
      token,
      isVerified: isVerified,
    };
  }

  async exportUsersExcel(req, res) {
    let tempFilePath = null;
    const fs = require("fs");
    const path = require("path");

    try {
      const { role } = req.query;
      let query = {};

      if (role && role.toLowerCase() !== "all") {
        query.role = { $regex: new RegExp(`^${role}$`, "i") };
      }

      // No pagination, no isDisabled filter -> fetch all raw data
      const users = await this.model.find(query).sort({ createdAt: -1 }).lean();

      if (!users.length) {
        return res.status(404).json({
          success: false,
          message: "No users found for the specified criteria",
        });
      }

      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Users");

      const allKeys = new Set();
      users.forEach((u) => Object.keys(u).forEach((k) => allKeys.add(k)));
      
      // Remove extremely sensitive or useless system fields
      allKeys.delete("password");
      allKeys.delete("phoneOtp");

      const keysArray = Array.from(allKeys);

      worksheet.columns = keysArray.map((key) => ({
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1").trim(),
        key: key,
      }));

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };

      users.forEach((user) => {
        const rowData = {};
        keysArray.forEach((key) => {
          let val = user[key];
          if (val === null || val === undefined) {
            rowData[key] = "-";
          } else if (val instanceof Date) {
            rowData[key] = val.toLocaleString("en-IN");
          } else if (typeof val === "object") {
            rowData[key] = JSON.stringify(val);
          } else {
            rowData[key] = val.toString();
          }
        });
        worksheet.addRow(rowData);
      });

      worksheet.columns.forEach((column) => {
        column.width = 25;
      });

      const timestamp = new Date().toISOString().split("T")[0];
      const uniqueId = Date.now();
      const filename = `Users_${timestamp}_${uniqueId}.xlsx`;

      const tempDir = path.join(__dirname, "../../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      tempFilePath = path.join(tempDir, filename);
      await workbook.xlsx.writeFile(tempFilePath);

      const fileBuffer = fs.readFileSync(tempFilePath);

      const { s3Client } = require("../middleware/s3Upload");
      const { PutObjectCommand } = require("@aws-sdk/client-s3");

      const folderPath = process.env.BUCKET_FOLDER_PATH || "TourTravels/";
      const s3Key = `${folderPath}EXCEL/${filename}`;

      const uploadParams = {
        Bucket: process.env.LINODE_OBJECT_BUCKET || "leadkart",
        Key: s3Key,
        Body: fileBuffer,
        ACL: "public-read",
        ContentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ContentDisposition: `attachment; filename="${filename}"`,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const endpoint = process.env.LINODE_OBJECT_STORAGE_ENDPOINT;
      const bucket = process.env.LINODE_OBJECT_BUCKET;
      const fileUrl = `${endpoint}/${bucket}/${s3Key}`;

      fs.unlinkSync(tempFilePath);
      tempFilePath = null;

      return res.status(200).json({
        success: true,
        message: "Users exported to Excel successfully",
        data: {
          fileUrl,
          filename,
          recordCount: users.length,
          key: s3Key,
        },
      });
    } catch (error) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to export users",
      });
    }
  }
}

module.exports = UserController;
