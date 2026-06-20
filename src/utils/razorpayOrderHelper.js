const { isMockPaymentEnabled } = require("./mongoSession");

function buildMockOrder({ amount, currency = "INR" }) {
  return {
    id: `order_mock_${Date.now()}`,
    amount,
    currency,
  };
}

function isRazorpayAuthError(error) {
  const description = String(
    error?.error?.description || error?.message || ""
  ).toLowerCase();

  return (
    error?.statusCode === 401 ||
    error?.error?.code === "BAD_REQUEST_ERROR" ||
    description.includes("authentication failed") ||
    description.includes("authentication")
  );
}

/**
 * Create a Razorpay order, or a mock order when mock mode is on or live auth fails.
 */
async function createRazorpayOrderSafe(razorpay, options) {
  if (isMockPaymentEnabled()) {
    return {
      order: buildMockOrder(options),
      mockPayment: true,
      razorpayFallback: false,
    };
  }

  try {
    const order = await razorpay.orders.create(options);
    return {
      order,
      mockPayment: false,
      razorpayFallback: false,
    };
  } catch (error) {
    if (isRazorpayAuthError(error)) {
      console.warn(
        "[Razorpay] Authentication failed — using mock order fallback:",
        error?.error?.description || error?.message
      );
      return {
        order: buildMockOrder(options),
        mockPayment: true,
        razorpayFallback: true,
      };
    }
    throw error;
  }
}

module.exports = {
  buildMockOrder,
  createRazorpayOrderSafe,
  isRazorpayAuthError,
};
