const express = require('express');
const crypto = require('crypto');
const { cached } = require('../middleware/cache');
const { logCheck } = require('../middleware/logger');

const router = express.Router();

router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    logCheck(req, 'Password', 'INVALID_INPUT', { status: 'Error' }, startTime);
    return res.status(400).json({ error: 'Provide a "password" string in the request body.' });
  }

  logCheck(req, 'Password', '********', {}, startTime);

  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const result = await cached(`pwd:${prefix}`, async () => {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
      });

      if (!response.ok) throw new Error(`Pwned Passwords API returned ${response.status}`);

      const text = await response.text();
      const lines = text.split('\n');
      const matches = {};
      for (const line of lines) {
        const [hashSuffix, count] = line.trim().split(':');
        if (hashSuffix) matches[hashSuffix] = Number(count);
      }
      return { matches };
    });

    const count = result.matches[suffix] || 0;
    const data = {
      breached: count > 0,
      timesSeen: count,
      cached: result.cached,
    };

    const status = data.breached ? 'Exposed' : 'Clear';
    logCheck(req, 'Password', '********', { status, breachCount: count }, startTime);

    res.json({
      breached: data.breached,
      timesSeen: data.timesSeen,
      cached: data.cached,
      message: count > 0
        ? `This password has appeared in ${count.toLocaleString()} known breaches.`
        : 'This password was not found in any known breach dataset.'
    });
  } catch (err) {
    logCheck(req, 'Password', '********', { status: 'Error' }, startTime);
    res.status(502).json({ error: 'Could not reach Pwned Passwords API.', detail: err.message });
  }
});

module.exports = router;
