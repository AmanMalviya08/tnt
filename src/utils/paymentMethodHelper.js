const ORDER_PAYMENT_METHODS = ["online", "cash", "upi", "card", "wallet"];

const BOOKING_PAYMENT_METHODS = [
  "Online",
  "Cash",
  "Bank Transfer",
  "upi",
  "UPI",
  "Card",
  "Wallet",
];

/**
 * Map Razorpay / client / mock labels to orderModel.paymentMethod enum.
 */
function normalizeOrderPaymentMethod(method) {
  const key = String(method || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");

  const map = {
    "mock upi": "upi",
    upi: "upi",
    card: "card",
    credit: "card",
    debit: "card",
    cards: "card",
    netbanking: "online",
    netbank: "online",
    online: "online",
    wallet: "wallet",
    cash: "cash",
    paylater: "online",
    razorpay: "online",
  };

  const normalized = map[key] || "online";
  return ORDER_PAYMENT_METHODS.includes(normalized) ? normalized : "online";
}

/**
 * Map to bookingModel.paymentMethod enum.
 */
function normalizeBookingPaymentMethod(method) {
  const orderMethod = normalizeOrderPaymentMethod(method);

  const map = {
    upi: "UPI",
    card: "Card",
    wallet: "Wallet",
    cash: "Cash",
    online: "Online",
  };

  const normalized = map[orderMethod] || "Online";
  return BOOKING_PAYMENT_METHODS.includes(normalized) ? normalized : "Online";
}

module.exports = {
  ORDER_PAYMENT_METHODS,
  BOOKING_PAYMENT_METHODS,
  normalizeOrderPaymentMethod,
  normalizeBookingPaymentMethod,
};
