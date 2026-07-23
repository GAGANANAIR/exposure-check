const express = require('express');
const { cached } = require('../middleware/cache');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Uses XposedOrNot's free public breach-check API — no signup, no key.
// (HIBP's own v3 email API is paid-only; this is the free equivalent.)
router.get('/', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Provide a valid "email" query parameter.' });
  }

  try {
    const result = await cached(`email:${email}`, async () => {
      const response = await fetch(
        `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`
      );

      // XposedOrNot returns 404 with a "not found" body when there are no breaches —
      // that's a valid clean result, not an error.
      if (response.status === 404) {
        return { breaches: [], breachCount: 0 };
      }

      if (!response.ok) {
        throw new Error(`XposedOrNot API returned ${response.status}`);
      }

      const data = await response.json();
      const breachList = data?.breaches?.[0] || [];
      return { breaches: breachList, breachCount: breachList.length };
    });

    res.json({
      email,
      exposed: result.breachCount > 0,
      breachCount: result.breachCount,
      breaches: result.breaches,
      cached: result.cached,
      message:
        result.breachCount > 0
          ? `Found in ${result.breachCount} known breach source(s). Check the breach names below and update those account passwords.`
          : 'No breaches found for this email in the checked databases.',
      note: 'Coverage is limited to what XposedOrNot indexes. For a second free opinion, also check haveibeenpwned.com manually.',
    });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach breach-check API.', detail: err.message });
  }
});

module.exports = router;
