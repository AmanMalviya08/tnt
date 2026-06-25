/**
 * Dynamic pricing engine — calculates surcharges based on admin rules and context.
 */

const { pricingRuleModel } = require("../models/pricingRuleModel");
const { pricingAuditLogModel } = require("../models/pricingAuditLogModel");

const DEFAULT_WEEKEND_DAYS = [0, 6]; // Sunday, Saturday
const PRICING_CACHE_TTL_MS = 5 * 60 * 1000;
const pricingCache = new Map();

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isRuleActive(rule, travelDate = new Date()) {
  if (!rule.isActive) return false;
  const date = new Date(travelDate);
  if (rule.validFrom && date < new Date(rule.validFrom)) return false;
  if (rule.validTo && date > new Date(rule.validTo)) return false;
  return true;
}

function matchesScope(rule, { packageId, tourId }) {
  const { packageIds = [], tourIds = [] } = rule.conditions || {};
  if (packageIds.length && packageId) {
    return packageIds.some((id) => String(id) === String(packageId));
  }
  if (tourIds.length && tourId) {
    return tourIds.some((id) => String(id) === String(tourId));
  }
  if (packageIds.length || tourIds.length) return false;
  return true;
}

function applyAdjustment(baseAmount, rule) {
  const value = Number(rule.adjustmentValue || 0);
  if (rule.adjustmentType === "percent") {
    return roundCurrency((baseAmount * value) / 100);
  }
  return roundCurrency(value);
}

function evaluateWeekendRule(rule, travelDate) {
  const days = rule.conditions?.weekendDays?.length
    ? rule.conditions.weekendDays
    : DEFAULT_WEEKEND_DAYS;
  const day = new Date(travelDate).getDay();
  return days.includes(day);
}

function evaluateFestivalRule(rule, travelDate) {
  const dates = rule.conditions?.festivalDates || [];
  if (!dates.length) return false;
  const travel = new Date(travelDate);
  travel.setHours(0, 0, 0, 0);
  return dates.some((d) => {
    const fest = new Date(d);
    fest.setHours(0, 0, 0, 0);
    return fest.getTime() === travel.getTime();
  });
}

function evaluateDemandRule(rule, occupancyPercent) {
  const min = rule.conditions?.minOccupancyPercent ?? 70;
  return occupancyPercent >= min;
}

function evaluateSeatRule(rule, remainingSeats) {
  const maxRemaining = rule.conditions?.maxRemainingSeats ?? 5;
  return remainingSeats <= maxRemaining;
}

function computeOccupancy(tourData) {
  if (!tourData) return 0;
  const totalSeats =
    (tourData.lowerSeats?.length || 0) +
    (tourData.upperSeats?.length || 0) +
    (tourData.seats?.length || 0);
  const booked = tourData.bookedSeatNumbers?.length || 0;
  if (!totalSeats) return 0;
  return Math.round((booked / totalSeats) * 100);
}

function computeRemainingSeats(tourData) {
  if (!tourData) return 999;
  const totalSeats =
    (tourData.lowerSeats?.length || 0) +
    (tourData.upperSeats?.length || 0) +
    (tourData.seats?.length || 0);
  const booked = tourData.bookedSeatNumbers?.length || 0;
  return Math.max(totalSeats - booked, 0);
}

async function calculateDynamicPrice(context = {}) {
  const {
    baseAmount = 0,
    travelDate = new Date(),
    packageId,
    tourId,
    tourData,
    userId,
    adults = 1,
  } = context;

  const base = roundCurrency(baseAmount);
  const breakdown = [
    { label: "Base Price", amount: base, type: "base" },
  ];
  const appliedRuleIds = [];

  const rules = await pricingRuleModel
    .find({ isActive: true })
    .sort({ priority: 1 })
    .lean();

  const occupancyPercent = computeOccupancy(tourData);
  const remainingSeats = computeRemainingSeats(tourData);

  for (const rule of rules) {
    if (!isRuleActive(rule, travelDate)) continue;
    if (!matchesScope(rule, { packageId, tourId })) continue;

    let applies = false;
    switch (rule.ruleType) {
      case "weekend":
        applies = evaluateWeekendRule(rule, travelDate);
        break;
      case "festival":
        applies = evaluateFestivalRule(rule, travelDate);
        break;
      case "demand":
        applies = evaluateDemandRule(rule, occupancyPercent);
        break;
      case "seat_availability":
        applies = evaluateSeatRule(rule, remainingSeats);
        break;
      case "custom":
        applies = true;
        break;
      default:
        applies = false;
    }

    if (!applies) continue;

    const charge = applyAdjustment(base, rule);
    if (charge <= 0) continue;

    breakdown.push({
      label: rule.name,
      amount: charge,
      type: rule.ruleType,
      ruleId: rule._id,
    });
    appliedRuleIds.push(rule._id);
  }

  const surcharges = breakdown
    .filter((b) => b.type !== "base")
    .reduce((sum, b) => sum + b.amount, 0);

  const subtotal = roundCurrency(base + surcharges);

  return {
    baseAmount: base,
    surchargesTotal: roundCurrency(surcharges),
    subtotalBeforeTax: subtotal,
    breakdown,
    appliedRuleIds,
    meta: {
      occupancyPercent,
      remainingSeats,
      adults,
      userId,
    },
  };
}

async function logPricingAudit(payload) {
  try {
    await pricingAuditLogModel.create(payload);
  } catch (err) {
    console.error("[DynamicPricing] Audit log failed:", err.message);
  }
}

/**
 * Occupancy-based dynamic pricing:
 * dynamicPrice = basePrice × [1 + (1 - seatsRemaining/totalSeats) × demandFactor]
 * Surge: 1.0x–2.5x | Discount: 0.8x–1.0x when seats are plentiful
 */
function computeOccupancyMultiplier({
  seatsRemaining = 0,
  totalSeats = 1,
  demandFactor = 1,
  daysUntilDeparture = 30,
}) {
  const occupancyRate = 1 - Math.min(seatsRemaining / Math.max(totalSeats, 1), 1);
  let multiplier = 1 + occupancyRate * Math.min(Math.max(demandFactor, 0), 1.5);

  if (daysUntilDeparture <= 3) {
    multiplier += 0.1;
  } else if (daysUntilDeparture <= 7) {
    multiplier += 0.05;
  }

  if (occupancyRate < 0.3) {
    multiplier = Math.max(0.8, multiplier - 0.15);
  }

  return Math.min(Math.max(multiplier, 0.8), 2.5);
}

function buildPricingCacheKey(context) {
  return [
    context.packageId || "",
    context.tourId || "",
    context.baseAmount,
    context.adults,
    computeRemainingSeats(context.tourData),
  ].join(":");
}

async function calculateOccupancyBasedPrice(context = {}) {
  const cacheKey = buildPricingCacheKey(context);
  const cached = pricingCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < PRICING_CACHE_TTL_MS) {
    return cached.result;
  }

  const {
    baseAmount = 0,
    travelDate = new Date(),
    packageId,
    tourId,
    tourData,
    userId,
    adults = 1,
    demandFactor = 1,
  } = context;

  const base = roundCurrency(baseAmount);
  const remainingSeats = computeRemainingSeats(tourData);
  const totalSeats =
    (tourData?.lowerSeats?.length || 0) +
    (tourData?.upperSeats?.length || 0) +
    (tourData?.seats?.length || 0) ||
    tourData?.totalSeats ||
    1;

  const daysUntilDeparture = Math.max(
    0,
    Math.ceil((new Date(travelDate) - new Date()) / (1000 * 60 * 60 * 24))
  );

  const multiplier = computeOccupancyMultiplier({
    seatsRemaining: remainingSeats,
    totalSeats,
    demandFactor,
    daysUntilDeparture,
  });

  const dynamicAmount = roundCurrency(base * multiplier);
  const priceChangePercent = Math.round((multiplier - 1) * 100);

  const ruleResult = await calculateDynamicPrice({
    baseAmount: dynamicAmount,
    travelDate,
    packageId,
    tourId,
    tourData,
    userId,
    adults,
  });

  const urgencyMessage =
    remainingSeats <= 5 && priceChangePercent > 0
      ? `Only ${remainingSeats} seats left! Price increased by ${priceChangePercent}%`
      : priceChangePercent < 0
        ? `Great deal! Price reduced by ${Math.abs(priceChangePercent)}%`
        : null;

  const result = {
    ...ruleResult,
    baseAmount: base,
    dynamicMultiplier: multiplier,
    dynamicAmount,
    priceChangePercent,
    urgencyMessage,
    seatsRemaining: remainingSeats,
    totalSeats,
    daysUntilDeparture,
    cachedAt: new Date().toISOString(),
  };

  pricingCache.set(cacheKey, { ts: Date.now(), result });
  return result;
}

module.exports = {
  calculateDynamicPrice,
  calculateOccupancyBasedPrice,
  computeOccupancyMultiplier,
  logPricingAudit,
  roundCurrency,
};
