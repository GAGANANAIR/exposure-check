const express = require('express');
const crypto = require('crypto');
const { cached } = require('../middleware/cache');

const router = express.Router();

// Uses HIBP's Pwned Passwords k-anonymity API — genuinely free, no key,
// no rate limit. Only the first 5 chars of the SHA-1 hash ever leave your
// server, so the real password never crosses the network.
router.post('/', async (req, res) => {
  const { password } = req.body || {};

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Provide a "password" string in the request body.' });
  }

  const sha1 = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const result = await cached(`pwd:${prefix}`, async () => {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' }, // requests padded response, extra privacy
      });

      if (!response.ok) {
        throw new Error(`Pwned Passwords API returned ${response.status}`);
      }

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

    res.json({
      breached: count > 0,
      timesSeen: count,
      cached: result.cached,
      message:
        count > 0
          ? `This password has appeared in ${count.toLocaleString()} known breaches. Change it anywhere you use it.`
          : 'This password was not found in any known breach dataset.',
    });
  } catch (err) {
    res.status(502).json({ error: 'Could not reach Pwned Passwords API.', detail: err.message });
  }
});

module.exports = router;
