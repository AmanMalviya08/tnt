/**
 * Aadhaar verification service — provider abstraction layer.
 * Swap AADHAAR_PROVIDER=mock|government in .env when govt API is available.
 */

const crypto = require("crypto");
const {
  sanitizeAadhaar,
  isValidAadhaarFormat,
  maskAadhaar,
} = require("../utils/aadhaarValidator");

const MOCK_FIRST_NAMES = [
  "Aarav", "Priya", "Rahul", "Sneha", "Vikram", "Ananya", "Rohan", "Kavya",
];
const MOCK_LAST_NAMES = [
  "Sharma", "Patil", "Desai", "Joshi", "Kulkarni", "Mehta", "Rao", "Singh",
];

class MockAadhaarProvider {
  async fetchNameByAadhaar(aadhaarNumber) {
    const digits = sanitizeAadhaar(aadhaarNumber);
    const hash = crypto.createHash("sha256").update(digits).digest("hex");
    const firstIdx = parseInt(hash.slice(0, 2), 16) % MOCK_FIRST_NAMES.length;
    const lastIdx = parseInt(hash.slice(2, 4), 16) % MOCK_LAST_NAMES.length;
    return {
      fullName: `${MOCK_FIRST_NAMES[firstIdx]} ${MOCK_LAST_NAMES[lastIdx]}`,
      provider: "mock",
      maskedAadhaar: maskAadhaar(digits),
    };
  }
}

class GovernmentAadhaarProvider {
  constructor() {
    this.apiUrl = process.env.AADHAAR_GOV_API_URL;
    this.apiKey = process.env.AADHAAR_GOV_API_KEY;
  }

  async fetchNameByAadhaar(aadhaarNumber) {
    if (!this.apiUrl || !this.apiKey) {
      const err = new Error(
        "Government Aadhaar API is not configured. Set AADHAAR_GOV_API_URL and AADHAAR_GOV_API_KEY."
      );
      err.code = "AADHAAR_PROVIDER_NOT_CONFIGURED";
      throw err;
    }

    // Placeholder for UIDAI-authorized integration
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ aadhaar: sanitizeAadhaar(aadhaarNumber) }),
    });

    if (!response.ok) {
      const err = new Error("Aadhaar verification service unavailable");
      err.code = "AADHAAR_API_ERROR";
      err.statusCode = response.status;
      throw err;
    }

    const data = await response.json();
    return {
      fullName: data.name || data.fullName,
      provider: "government",
      maskedAadhaar: maskAadhaar(aadhaarNumber),
    };
  }
}

function getProvider() {
  const provider = (process.env.AADHAAR_PROVIDER || "mock").toLowerCase();
  if (provider === "government") {
    return new GovernmentAadhaarProvider();
  }
  return new MockAadhaarProvider();
}

async function verifyAndFetchName(aadhaarNumber) {
  const digits = sanitizeAadhaar(aadhaarNumber);

  if (!isValidAadhaarFormat(digits)) {
    const err = new Error("Invalid Aadhaar number. Please enter a valid 12-digit Aadhaar.");
    err.code = "INVALID_AADHAAR";
    throw err;
  }

  const provider = getProvider();
  const result = await provider.fetchNameByAadhaar(digits);

  if (!result?.fullName) {
    const err = new Error("Could not fetch name for this Aadhaar number.");
    err.code = "NAME_NOT_FOUND";
    throw err;
  }

  return {
    success: true,
    fullName: result.fullName,
    maskedAadhaar: result.maskedAadhaar,
    provider: result.provider,
  };
}

module.exports = {
  verifyAndFetchName,
  MockAadhaarProvider,
  GovernmentAadhaarProvider,
};
