function normalizePhone(phone) {
  if (phone === null || phone === undefined) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function getPhoneLookupVariants(phone) {
  const trimmed = String(phone || "").trim();
  const normalized = normalizePhone(trimmed);
  const variants = new Set();

  if (trimmed) variants.add(trimmed);
  if (normalized) {
    variants.add(normalized);
    if (normalized.length === 10) {
      variants.add(`+91${normalized}`);
      variants.add(`91${normalized}`);
      variants.add(`+91 ${normalized}`);
    }
  }

  return Array.from(variants).filter(Boolean);
}

function buildPhoneQuery(phone) {
  const variants = getPhoneLookupVariants(phone);
  if (!variants.length) return null;
  return { $or: variants.map((value) => ({ phone: value })) };
}

module.exports = {
  normalizePhone,
  getPhoneLookupVariants,
  buildPhoneQuery,
};
