const env = require("../config/env");

const buildKey = (req, keyGenerator) =>
  typeof keyGenerator === "function" ? keyGenerator(req) : req.ip;

const createRateLimiter = ({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  max = env.RATE_LIMIT_MAX,
  message = "Too many requests. Please try again later.",
  keyGenerator,
} = {}) => {
  const hits = new Map();
  let requestCounter = 0;

  return (req, res, next) => {
    const key = buildKey(req, keyGenerator);
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + windowMs;
    }

    entry.count += 1;
    hits.set(key, entry);
    requestCounter += 1;

    // Periodic cleanup of stale keys to avoid unbounded memory growth.
    if (requestCounter % 200 === 0) {
      hits.forEach((value, mapKey) => {
        if (now > value.resetTime) {
          hits.delete(mapKey);
        }
      });
    }

    const remaining = Math.max(max - entry.count, 0);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1000)));

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message,
      });
    }

    next();
  };
};

const globalApiLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  keyGenerator: (req) => `${req.ip}:${req.method}`,
});

const authLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  message: "Too many authentication attempts. Please try again later.",
  keyGenerator: (req) => `${req.ip}:${req.path}`,
});

module.exports = {
  createRateLimiter,
  globalApiLimiter,
  authLimiter,
};
