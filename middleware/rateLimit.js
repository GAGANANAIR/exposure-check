// Minimal per-IP sliding-window rate limiter.
// Purpose: keep total outbound calls to free-tier APIs under their monthly caps
// (e.g. NumVerify's 100/month) even if the site gets shared around.
// Note: in-memory only — fine for a single-instance deploy. If you scale to
// multiple server instances, move this to a shared store (Redis) instead.

const hits = new Map(); // ip -> [timestamps]

function rateLimit(req, res, next) {
  const limit = Number(process.env.RATE_LIMIT_PER_HOUR || 20);
  const windowMs = 60 * 60 * 1000; // 1 hour
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  const now = Date.now();

  const timestamps = (hits.get(ip) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    const retryAfterMs = windowMs - (now - timestamps[0]);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `You've hit the limit of ${limit} checks per hour. Try again in about ${Math.ceil(
        retryAfterMs / 60000
      )} minute(s).`,
    });
  }

  timestamps.push(now);
  hits.set(ip, timestamps);
  next();
}

module.exports = rateLimit;
