/**
 * Parses dates from multiple formats used by the mobile app and admin panel.
 * Supports: ISO (YYYY-MM-DD), DD/MM/YYYY, DD-MM-YYYY, Date objects, timestamps.
 */
function parseFlexibleDate(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const str = String(value).trim();

  // ISO: YYYY-MM-DD or full ISO string
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  // DD/MM/YYYY or DD-MM-YYYY (app default)
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const parsed = new Date(year, month - 1, day);
    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    ) {
      return parsed;
    }
  }

  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

module.exports = {
  parseFlexibleDate,
  addDays,
};
