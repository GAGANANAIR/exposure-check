# Exposure Check

A free, self-hosted tool to check your **own** password, email, and phone number against public breach/validation data. No paid API keys required for the core features.

## What it uses (all free)

| Check | Source | Cost |
|---|---|---|
| Password leaked? | [HIBP Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords) (k-anonymity) | Free, no key, no rate limit |
| Email in a breach? | [XposedOrNot](https://xposedornot.com) public API | Free, no key |
| Phone valid/format? | [libphonenumber-js](https://github.com/catamphetamine/libphonenumber-js) | Free, runs locally, no network call |
| Phone carrier/line type (optional) | [NumVerify](https://numverify.com) | Free tier: 100 lookups/month, requires a free key |

No dark-web crawling is included — that space genuinely has no free tier. This tool is honest about that: it aggregates public breach databases, it doesn't claim to monitor the dark web.

## Setup

```bash
npm install
cp .env.example .env
# optional: add NUMVERIFY_API_KEY to .env for carrier/line-type lookups
npm start
```

Visit `http://localhost:3000`.

## How privacy is handled

- Nothing is written to a database. Each check is stateless.
- Passwords are hashed (SHA-1) **before** anything leaves your server; only the first 5 hex characters of the hash are sent to the Pwned Passwords API (k-anonymity — the real password and full hash never leave your machine).
- An in-memory cache (`middleware/cache.js`) avoids repeat calls to the same email/phone/password-prefix within the TTL window, to protect free-tier quotas. It resets on server restart — swap in Redis/Supabase if you need it to persist.
- A per-IP rate limiter (`middleware/rateLimit.js`) caps checks per hour (default 20) so no single user can burn through your NumVerify monthly quota.

## Deploying for free

Any of these work on their free tiers:
- **Render** – free web service tier
- **Railway** – free trial credit, then usage-based
- **Fly.io** – free allowance for small apps

Set `NUMVERIFY_API_KEY`, `RATE_LIMIT_PER_HOUR`, and `CACHE_TTL_MINUTES` as environment variables on whichever platform you use — don't commit `.env` to git (it's already in `.gitignore`).

## Important: scope this to self-checks

This tool is built for people checking their *own* password/email/phone. If you extend it to let anyone look up *someone else's* email or phone number, you move into people-search territory, which carries its own legal and platform-ToS considerations depending on your jurisdiction and which upstream APIs you use. Worth deciding deliberately rather than by default.

## Extending it

- Swap XposedOrNot for a different free breach source if you want broader coverage.
- Add a combined numeric risk score in `public/app.js` (`updateVerdict()`) if you want more granularity than "clear / exposed".
- Add Supabase for persistent caching if you outgrow in-memory.
