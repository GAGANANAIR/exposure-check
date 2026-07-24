const express = require('express');
const { cached } = require('../middleware/cache');
const { logCheck } = require('../middleware/logger');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', async (req, res) => {
  const startTime = Date.now();
  const email = String(req.query.email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    logCheck(req, 'Email', email, { status: 'Invalid Email' }, startTime);
    return res.status(400).json({ error: 'Provide a valid "email" query parameter.' });
  }

  logCheck(req, 'Email', email, {}, startTime);

  try {
    const result = await cached(`email:${email}`, async () => {
      const response = await fetch(
        `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`
      );

      if (response.status === 404) {
        return { breaches: [], breachCount: 0 };
      }

      if (!response.ok) throw new Error(`XposedOrNot API returned ${response.status}`);

      const data = await response.json();
      const breachList = data?.breaches?.[0] || [];
      return { breaches: breachList, breachCount: breachList.length };
    });

    const exposed = result.breachCount > 0;
    logCheck(req, 'Email', email, {
      status: exposed ? 'Exposed' : 'Clear',
      breachCount: result.breachCount
    }, startTime);

    res.json({
      email,
      exposed,
      breachCount: result.breachCount,
      breaches: result.breaches,
      cached: result.cached,
      message: exposed
        ? `Found in ${result.breachCount} known breach source(s).`
        : 'No breaches found for this email.',
    });
  } catch (err) {
    logCheck(req, 'Email', email, { status: 'Error' }, startTime);
    res.status(502).json({ error: 'Could not reach breach-check API.', detail: err.message });
  }
});

module.exports = router;
