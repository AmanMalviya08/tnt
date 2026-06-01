const Razorpay = require('razorpay');
const crypto = require('crypto');
const path = require('path');

// Initialize Razorpay instance
const getRazorpayInstance = () => {
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
};

const mockDatabase = {
    orders: []
};

exports.serveTestUI = (req, res) => {
    res.sendFile(path.join(__dirname, 'test-ui.html'));
};

exports.createOrder = async (req, res) => {
    try {
        const { amount, currency = "INR" } = req.body;

        const razorpay = getRazorpayInstance();

        const options = {
            amount: amount * 100, // amount in the smallest currency unit (paise)
            currency,
            receipt: `receipt_order_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        // Store in mock database instead of real DB
        mockDatabase.orders.push(order);
        
        console.log("Mock Environment - Order Created Successfully:", order);

        res.status(200).json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("Mock Environment - Error creating order:", error);
        res.status(500).json({ success: false, message: "Something went wrong", error });
    }
};

exports.verifyPayment = (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        console.log("\n=== Mock Environment - Payment Verification Payload ===");
        console.log("Order ID:", razorpay_order_id);
        console.log("Payment ID:", razorpay_payment_id);
        console.log("Signature:", razorpay_signature);

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            console.log("✅ Mock Environment - Payment Verified Successfully - NO DB AFFECTED");
            
            // Mock DB interaction
            const order = mockDatabase.orders.find(o => o.id === razorpay_order_id);
            if (order) order.status = "paid";

            return res.status(200).json({
                success: true,
                message: "Payment verified successfully"
            });
        } else {
            console.log("❌ Mock Environment - Invalid Signature");
            return res.status(400).json({
                success: false,
                message: "Invalid signature sent!"
            });
        }
    } catch (error) {
        console.error("Mock Environment - Error verifying payment:", error);
        res.status(500).json({ success: false, message: "Internal Server Error!", error });
    }
};
