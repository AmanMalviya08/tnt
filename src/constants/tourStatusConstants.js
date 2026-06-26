// FEATURE: Tour Live Status | Added: 2026-06-26 | Status: NEW

const TOUR_JOURNEY_STATUSES = [
  {
    code: "JOURNEY_STARTED",
    label: "Journey Started",
    order: 1,
    icon: "flag",
  },
  {
    code: "TRAVELLING_BY_BUS",
    label: "Travelling By Bus",
    order: 2,
    icon: "bus",
  },
  {
    code: "TRAVELLING_BY_TRAIN",
    label: "Travelling By Train",
    order: 3,
    icon: "train",
  },
  {
    code: "WALKING_ON_FOOT",
    label: "Walking / On Foot",
    order: 4,
    icon: "walk",
  },
  {
    code: "REACHED_TEMPLE",
    label: "Reached Temple",
    order: 5,
    icon: "temple",
  },
  {
    code: "TEMPLE_VISIT_IN_PROGRESS",
    label: "Temple Visit in Progress",
    order: 6,
    icon: "prayer",
  },
  {
    code: "BREAK_REST_STOP",
    label: "Break / Rest Stop",
    order: 7,
    icon: "coffee",
  },
  {
    code: "AT_HOTEL",
    label: "At Hotel",
    order: 8,
    icon: "hotel",
  },
  {
    code: "VISIT_AT_ATTRACTION",
    label: "Visit at Attraction",
    order: 9,
    icon: "camera",
  },
  {
    code: "RETURNING_JOURNEY",
    label: "Returning Journey",
    order: 10,
    icon: "return",
  },
  {
    code: "TOUR_COMPLETE",
    label: "Tour Complete",
    order: 11,
    icon: "check",
  },
];

const TOUR_STATUS_CODES = TOUR_JOURNEY_STATUSES.map((s) => s.code);

const TOUR_STATUS_BY_CODE = Object.fromEntries(
  TOUR_JOURNEY_STATUSES.map((s) => [s.code, s])
);

function getStatusLabel(code) {
  return TOUR_STATUS_BY_CODE[code]?.label || code;
}

function isValidTourStatusCode(code) {
  return TOUR_STATUS_CODES.includes(code);
}

module.exports = {
  TOUR_JOURNEY_STATUSES,
  TOUR_STATUS_CODES,
  TOUR_STATUS_BY_CODE,
  getStatusLabel,
  isValidTourStatusCode,
};
