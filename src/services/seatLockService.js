const { tourModel } = require("../models/tourModel");

const LOCK_DURATION_MS = 2 * 60 * 1000;

const SEAT_ARRAYS = ["seats", "lowerSeats", "upperSeats"];

function findSeatInTour(tour, seatNumber) {
  for (const arrayName of SEAT_ARRAYS) {
    const arr = tour[arrayName] || [];
    const idx = arr.findIndex((s) => String(s.number) === String(seatNumber));
    if (idx >= 0) {
      return { arrayName, index: idx, seat: arr[idx] };
    }
  }
  return null;
}

function isSeatLocked(seat) {
  if (!seat) return false;
  if (seat.status === "booked" || seat.status === "blocked") return true;
  if (seat.lockedUntil && new Date(seat.lockedUntil) > new Date()) return true;
  return false;
}

async function releaseExpiredLocks(tourId) {
  const tour = await tourModel.findById(tourId);
  if (!tour) return null;

  let changed = false;
  const now = new Date();

  for (const arrayName of SEAT_ARRAYS) {
    const arr = tour[arrayName] || [];
    for (let i = 0; i < arr.length; i++) {
      const seat = arr[i];
      if (
        seat.lockedUntil &&
        new Date(seat.lockedUntil) <= now &&
        seat.status !== "booked"
      ) {
        seat.status = "available";
        seat.lockedUntil = null;
        seat.lockedBy = null;
        changed = true;
      }
    }
  }

  if (changed) {
    tour.markModified("seats");
    tour.markModified("lowerSeats");
    tour.markModified("upperSeats");
    await tour.save();
  }

  return tour;
}

async function lockSeat(tourId, seatNumber, userId) {
  await releaseExpiredLocks(tourId);

  const tour = await tourModel.findById(tourId);
  if (!tour) throw new Error("Tour not found");

  const found = findSeatInTour(tour, seatNumber);
  if (!found) throw new Error("Seat not found");

  const { arrayName, index, seat } = found;

  if (seat.status === "booked") {
    throw new Error("Seat is already booked");
  }

  if (
    seat.lockedUntil &&
    new Date(seat.lockedUntil) > new Date() &&
    String(seat.lockedBy) !== String(userId)
  ) {
    throw new Error("Seat is temporarily held by another user");
  }

  const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
  tour[arrayName][index].status = "blocked";
  tour[arrayName][index].lockedUntil = lockedUntil;
  tour[arrayName][index].lockedBy = userId;
  tour.markModified(arrayName);
  await tour.save();

  return {
    seatNumber,
    lockedUntil,
    lockDurationMs: LOCK_DURATION_MS,
    seat: tour[arrayName][index],
  };
}

async function releaseSeat(tourId, seatNumber, userId) {
  const tour = await tourModel.findById(tourId);
  if (!tour) throw new Error("Tour not found");

  const found = findSeatInTour(tour, seatNumber);
  if (!found) throw new Error("Seat not found");

  const { arrayName, index, seat } = found;

  if (seat.status === "booked") {
    throw new Error("Cannot release a booked seat");
  }

  if (seat.lockedBy && String(seat.lockedBy) !== String(userId)) {
    throw new Error("You do not hold this seat lock");
  }

  tour[arrayName][index].status = "available";
  tour[arrayName][index].lockedUntil = null;
  tour[arrayName][index].lockedBy = null;
  tour.markModified(arrayName);
  await tour.save();

  return { seatNumber, released: true };
}

module.exports = {
  LOCK_DURATION_MS,
  lockSeat,
  releaseSeat,
  releaseExpiredLocks,
  isSeatLocked,
  findSeatInTour,
};
