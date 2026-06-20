/**
 * Aadhaar number validation using Verhoeff checksum algorithm.
 * Does not call external APIs — format validation only.
 */

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function sanitizeAadhaar(value) {
  return String(value || "").replace(/\s|-/g, "");
}

function isValidAadhaarFormat(aadhaarNumber) {
  const digits = sanitizeAadhaar(aadhaarNumber);
  if (!/^\d{12}$/.test(digits)) return false;
  if (/^[01]/.test(digits)) return false;

  let checksum = 0;
  const reversed = digits.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i += 1) {
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[i % 8][reversed[i]]];
  }
  return checksum === 0;
}

function maskAadhaar(aadhaarNumber) {
  const digits = sanitizeAadhaar(aadhaarNumber);
  if (digits.length < 4) return "XXXX-XXXX-XXXX";
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

module.exports = {
  sanitizeAadhaar,
  isValidAadhaarFormat,
  maskAadhaar,
};
