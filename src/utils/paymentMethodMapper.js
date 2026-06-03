/** Order model enum: online | cash | upi | card | wallet */
const ORDER_METHODS = new Set(["online", "cash", "upi", "card", "wallet"]);

/** Booking model enum (subset used on confirm) */
const BOOKING_METHODS = {
  online: "Online",
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  wallet: "Wallet",
};

/**
 * Maps client / Razorpay / mock labels to order.paymentMethod enum.
 * @param {string} [raw] - e.g. upi, paylater, wallet
 */
function mapToOrderPaymentMethod(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (!key || key === "mock" || key.includes("mockupi")) {
    return "upi";
  }

  const aliases = {
    upi: "upi",
    phonepe: "upi",
    phonepeupi: "upi",
    googlepay: "upi",
    gpay: "upi",
    paytm: "upi",
    paytmupi: "upi",
    amazonpay: "upi",
    amazonpayupi: "upi",
    card: "card",
    cards: "card",
    debit: "card",
    credit: "card",
    wallet: "wallet",
    cash: "cash",
    netbanking: "online",
    netbank: "online",
    bank: "online",
    banktransfer: "online",
    paylater: "online",
    online: "online",
    razorpay: "online",
  };

  if (aliases[key]) return aliases[key];
  if (ORDER_METHODS.has(key)) return key;

  return "online";
}

function mapToBookingPaymentMethod(raw) {
  const orderMethod = mapToOrderPaymentMethod(raw);
  return BOOKING_METHODS[orderMethod] || "Online";
}

module.exports = {
  mapToOrderPaymentMethod,
  mapToBookingPaymentMethod,
};
