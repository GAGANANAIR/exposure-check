// Minimal in-memory cache with TTL.
// Purpose: avoid re-hitting free-tier APIs (NumVerify, XposedOrNot, HIBP) for
// the same lookup, so a handful of repeat checks don't burn through monthly quotas.
// Note: resets on server restart. Good enough for a small/demo deployment;
// swap for Redis or Supabase if you need it to survive restarts.

const store = new Map();

function getTtlMs() {
  const minutes = Number(process.env.CACHE_TTL_MINUTES || 60);
  return minutes * 60 * 1000;
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value) {
  store.set(key, {
    value,
    expiresAt: Date.now() + getTtlMs(),
  });
}

// Wraps an async function with cache-or-fetch behavior.
async function cached(key, fn) {
  const hit = get(key);
  if (hit !== null) {
    return { ...hit, cached: true };
  }
  const result = await fn();
  set(key, result);
  return { ...result, cached: false };
}

module.exports = { get, set, cached };
