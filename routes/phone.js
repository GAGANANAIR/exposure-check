const express = require('express');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { cached } = require('../middleware/cache');
const { logCheck } = require('../middleware/logger');

const router = express.Router();

router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { phone } = req.body || {};

  if (!phone || typeof phone !== 'string') {
    logCheck(req, 'Phone', 'INVALID', { status: 'Error' }, startTime);
    return res.status(400).json({ error: 'Provide a "phone" string in the request body.' });
  }

  logCheck(req, 'Phone', phone, {}, startTime);

  let parsed;
  try {
    parsed = parsePhoneNumberFromString(phone);
  } catch (err) {
    logCheck(req, 'Phone', phone, { status: 'Invalid' }, startTime);
    return res.status(400).json({ error: 'Could not parse this phone number.' });
  }

  const localResult = {
    valid: !!parsed?.isValid(),
    country: parsed?.country || null,
    type: parsed?.getType ? parsed.getType() || 'unknown' : 'unknown',
  };

  const status = localResult.valid ? 'Valid' : 'Invalid';
  logCheck(req, 'Phone', phone, { status }, startTime);

  if (!localResult.valid || !process.env.NUMVERIFY_API_KEY) {
    return res.json({
      ...localResult,
      source: 'local',
      message: localResult.valid ? 'Valid number format' : 'Not a recognized number.',
    });
  }

  // NumVerify part (optional)
  try {
    const key = process.env.NUMVERIFY_API_KEY;
    const numberForLookup = localResult.e164 ? localResult.e164.replace('+', '') : phone.replace(/\D/g,'');

    const enrichResult = await cached(`phone:${numberForLookup}`, async () => {
      const response = await fetch(
        `https://apilayer.net/api/validate?access_key=${key}&number=${numberForLookup}`
      );
      if (!response.ok) throw new Error(`NumVerify returned ${response.status}`);
      return await response.json();
    });

    res.json({ ...localResult, ...enrichResult, source: 'numverify' });
  } catch (err) {
    res.json({ ...localResult, source: 'local', message: 'Valid (enrichment unavailable)' });
  }
});

module.exports = router;
