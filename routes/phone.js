const express = require('express');
const { parsePhoneNumberFromString, getExampleNumber } = require('libphonenumber-js');
const { cached } = require('../middleware/cache');

const router = express.Router();

// Step 1 is always free and instant: libphonenumber-js runs entirely locally
// (Google's own phone number metadata), no external call, no quota to burn.
// Step 2 is optional: if NUMVERIFY_API_KEY is set, we enrich with carrier/line-type
// data from NumVerify's free tier (100 lookups/month) — only called when the
// local check says the number is plausibly valid, to avoid wasting quota on junk input.
router.post('/', async (req, res) => {
  const { phone, defaultCountry } = req.body || {};

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Provide a "phone" string in the request body.' });
  }

  let parsed;
  try {
    parsed = parsePhoneNumberFromString(phone, defaultCountry || undefined);
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse this phone number.' });
  }

  const localResult = {
    input: phone,
    valid: !!parsed?.isValid(),
    e164: parsed ? parsed.number : null,
    country: parsed?.country || null,
    type: parsed?.getType ? parsed.getType() || 'unknown' : 'unknown',
  };

  if (!localResult.valid || !process.env.NUMVERIFY_API_KEY) {
    return res.json({
      ...localResult,
      source: 'local',
      message: localResult.valid
        ? 'Valid number format (local check only — set NUMVERIFY_API_KEY for carrier/line lookups).'
        : 'This does not look like a valid phone number.',
    });
  }

  // Enrich with NumVerify (free tier, key required)
  try {
    const key = process.env.NUMVERIFY_API_KEY;
    const numberForLookup = localResult.e164.replace('+', '');

    const result = await cached(`phone:${numberForLookup}`, async () => {
      const response = await fetch(
        `https://apilayer.net/api/validate?access_key=${key}&number=${numberForLookup}`
      );
      if (!response.ok) {
        throw new Error(`NumVerify API returned ${response.status}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.info || 'NumVerify returned an error');
      }
      return {
        carrier: data.carrier || null,
        lineType: data.line_type || null,
        location: data.location || null,
      };
    });

    res.json({
      ...localResult,
      source: 'numverify',
      carrier: result.carrier,
      lineType: result.lineType,
      location: result.location,
      cached: result.cached,
      message: 'Valid number, enriched with carrier/line-type data.',
    });
  } catch (err) {
    // NumVerify quota exhausted or erroring — gracefully fall back to local result
    res.json({
      ...localResult,
      source: 'local',
      message: `Valid number (carrier lookup unavailable: ${err.message}).`,
    });
  }
});

module.exports = router;
