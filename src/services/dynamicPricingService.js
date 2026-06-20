/**
 * Dynamic pricing engine — calculates surcharges based on admin rules and context.
 */

const { pricingRuleModel } = require("../models/pricingRuleModel");
const { pricingAuditLogModel } = require("../models/pricingAuditLogModel");

const DEFAULT_WEEKEND_DAYS = [0, 6]; // Sunday, Saturday

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

module.exports = {
  calculateDynamicPrice,
  logPricingAudit,
  roundCurrency,
};
