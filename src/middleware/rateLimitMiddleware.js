/**
 * Simple in-memory rate limiter for public endpoints.
 * For production at scale, replace with Redis-backed limiter.
 */

const buckets = new Map();

function rateLimit({ windowMs = 60_000, max = 60, keyPrefix = "rl" } = {}) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip || req.socket?.remoteAddress || "unknown"}:${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
      });
    }

    return next();
  };
}

module.exports = { rateLimit };
