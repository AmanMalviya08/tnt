const mongoose = require("mongoose");

/**
 * MongoDB multi-document transactions require a replica set or mongos.
 * Local standalone instances fail on any query using .session().
 * Set MONGODB_USE_TRANSACTIONS=true only when your cluster supports transactions.
 */
const USE_MONGO_TRANSACTIONS =
  process.env.MONGODB_USE_TRANSACTIONS === "true";

const hasRazorpayKeys = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

/**
 * Mock checkout when explicitly enabled or Razorpay keys are missing.
 * Set RAZORPAY_TEST_MODE=true with valid rzp_test_* keys to force live test checkout.
 */
const isMockPaymentEnabled = () => {
  const mockRequested =
    process.env.MOCK_PAYMENT === "true" ||
    process.env.USE_MOCK_PAYMENTS === "true";

  if (mockRequested) {
    return true;
  }

  if (!hasRazorpayKeys()) {
    return true;
  }

  if (process.env.RAZORPAY_TEST_MODE === "true") {
    return false;
  }

  // Keys present but test mode not forced — prefer mock in non-production.
  return process.env.NODE_ENV !== "production";
};

async function startOptionalSession() {
  if (!USE_MONGO_TRANSACTIONS) {
    return null;
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  return session;
}

async function commitOptionalSession(session) {
  if (!session) return;
  await session.commitTransaction();
  session.endSession();
}

async function abortOptionalSession(session) {
  if (!session) return;
  try {
    await session.abortTransaction();
  } finally {
    session.endSession();
  }
}

function saveOptions(session) {
  return session ? { session } : {};
}

function applySession(query, session) {
  return session ? query.session(session) : query;
}

module.exports = {
  USE_MONGO_TRANSACTIONS,
  isMockPaymentEnabled,
  startOptionalSession,
  commitOptionalSession,
  abortOptionalSession,
  saveOptions,
  applySession,
};
