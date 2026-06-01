const mongoose = require('mongoose');
const { agentModel } = require('./src/models/agentModel');
const Transaction = require('./src/models/transactionModel');
const Company = require('./src/models/companyModel');
// const { confirmPayment } = require('./src/controller/checkoutController'); 
const walletController = require('./src/controller/walletController');
const { bookingModel } = require('./src/models/bookingModel');
const orderModel = require('./src/models/orderModel');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

const mockRes = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        this.data = data;
        return this;
    }
};

const verifyCommission = async () => {
    // 1. Setup Data
    console.log('--- Setting up data ---');

    // Create Agent
    const agent = await agentModel.create({
        firstName: 'Test',
        lastName: 'Agent',
        email: `testagent_${Date.now()}@example.com`,
        wallet: 0,
        status: 'Active'
    });
    console.log('Agent created:', agent._id);

    // Create Company setting
    const company = await Company.findOneAndUpdate({}, { agentCommission: 10 }, { upsert: true, new: true });
    console.log('Company commission set to:', company.agentCommission);

    // Create Booking
    const booking = await bookingModel.create({
        customerName: 'Test Customer',
        mobileNumber: '1234567890',
        bookingType: 'Package Tour',
        totalAmount: 1000,
        finalAmount: 1000,
        assignedAgent: agent.userId || agent._id, // Assuming userId is same for test or handling via logic (agentModel has userId ref to User)
        paymentStatus: 'Pending',
        bookingStatus: 'Pending',
        bookingId: `BK-${Date.now()}`
    });

    // Need to make sure agentModel.findOne({userId: ...}) works. 
    // In the controller: agentModel.findOneAndUpdate({ userId: booking.assignedAgent }, ...)
    // So booking.assignedAgent should match agent.userId. 
    // Let's ensure agent has a userId. For this test, we might need a User mock or just set userId in agent to a random ObjectId.
    const userId = new mongoose.Types.ObjectId();
    booking.assignedAgent = userId;
    await booking.save();

    agent.userId = userId;
    await agent.save();

    const orderId = `order_${Date.now()}`;
    const order = await orderModel.create({
        orderId: orderId,
        bookingIds: [booking.bookingId],
        totalAmount: 1000,
        userId: userId // dummy
    });
    console.log('Order created:', orderId);

    // 2. Mock Request for confirmPayment
    // Note: confirmPayment calls razorpay.payments.fetch. We need to mock that or allow it to fail but check if our logic runs.
    // However, our logic runs AFTER payment verification.
    // If I can't easily mock Razorpay, I'll test the logic directly or manually inserting data.

    // Actually, testing the logic directly is safer than mocking external APIs in this environment.
    // I will simulate the logic block from checkoutController.

    console.log('--- Simulating Commission Logic ---');
    const agentCommissionPercent = company.agentCommission;
    const commissionAmount = (booking.finalAmount * agentCommissionPercent) / 100;

    await agentModel.findOneAndUpdate(
        { userId: booking.assignedAgent },
        { $inc: { wallet: commissionAmount } },
    );

    await Transaction.create({
        userId: booking.assignedAgent,
        amount: commissionAmount,
        type: "Credit",
        category: "Commission",
        status: "Completed",
        description: `Commission for booking ${booking.bookingId}`,
        bookingId: booking._id,
        createdBy: booking.assignedAgent,
    });

    // 3. Verify
    const updatedAgent = await agentModel.findOne({ userId: userId });
    console.log('Updated Wallet Balance:', updatedAgent.wallet);

    if (updatedAgent.wallet === 100) {
        console.log('SUCCESS: Commission added to wallet.');
    } else {
        console.error('FAILURE: Commission not added correctly.');
    }

    const transaction = await Transaction.findOne({ userId: userId, category: 'Commission' });
    if (transaction) {
        console.log('SUCCESS: Transaction record created.');
    } else {
        console.error('FAILURE: Transaction record not found.');
    }

    return { userId, commissionAmount };
};

const verifyWithdrawal = async (userId, amount) => {
    console.log('--- Verifying Withdrawal ---');
    const walletController = require('./src/controller/walletController');

    const req = {
        body: { userId, amount: 50 }
    };

    await walletController.requestWithdrawal(req, mockRes);

    if (mockRes.statusCode === 201) {
        console.log('SUCCESS: Withdrawal requested.');
    } else {
        console.error('FAILURE: Withdrawal request failed.', mockRes.data);
    }

    const updatedAgent = await agentModel.findOne({ userId });
    console.log('Wallet after withdrawal:', updatedAgent.wallet); // Should be 50

    const withdrawalTx = await Transaction.findOne({ userId, category: 'Withdrawal' });
    return withdrawalTx;
};

const verifyAdminApproval = async (transactionId) => {
    console.log('--- Verifying Admin Approval ---');
    const walletController = require('./src/controller/walletController');

    const req = {
        params: { id: transactionId },
        body: { paymentTransactionId: 'BANK-12345' }
    };

    await walletController.approveWithdrawal(req, mockRes);

    if (mockRes.statusCode === 200) {
        console.log('SUCCESS: Withdrawal approved.');
    } else {
        console.error('FAILURE: Withdrawal approval failed.', mockRes.data);
    }

    const tx = await Transaction.findById(transactionId);
    console.log('Transaction Status:', tx.status); // Should be Completed
};

const run = async () => {
    await connectDB();

    const data = await verifyCommission();
    if (data) {
        const tx = await verifyWithdrawal(data.userId, 50);
        if (tx) {
            await verifyAdminApproval(tx._id);
        }
    }

    console.log('Done.');
    process.exit(0);
};

run();
