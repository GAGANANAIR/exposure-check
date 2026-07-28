<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"/>
  <img src="https://img.shields.io/badge/privacy-k--anonymity%20password%20checks-8b5cf6" alt="k-anonymity"/>
  <img src="https://img.shields.io/badge/data-masked%20logging-ec4899" alt="Masked logging"/>
  <img src="https://img.shields.io/badge/no%20paid%20APIs%20required-blue" alt="No paid APIs required"/>
</p>

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
# optional: add LOGS_ACCESS_KEY to enable downloading check_logs.csv
# optional: add GITHUB_LOG_TOKEN + GITHUB_LOG_REPO for persistent logging
npm start
```

Visit `http://localhost:3000`.

## How privacy is handled

- Nothing is written to a database. Each check is stateless.
- Passwords are hashed (SHA-1) **before** anything leaves your server; only the first 5 hex characters of the hash are sent to the Pwned Passwords API (k-anonymity — the real password and full hash never leave your machine).
- An in-memory cache (`middleware/cache.js`) avoids repeat calls to the same email/phone/password-prefix within the TTL window, to protect free-tier quotas. It resets on server restart — swap in Redis/Supabase if you need it to persist.
- A per-IP rate limiter (`middleware/rateLimit.js`) caps checks per hour (default 20) so no single user can burn through your NumVerify monthly quota.

## Logging & analytics

Every check event is logged with rich, useful metadata — but the actual value someone typed is **always masked**, no matter what:

| Field | Example | Notes |
|---|---|---|
| Time | `2026-07-24T11:30:25.000Z` | UTC timestamp |
| VisitorID | `8f8b2d3a` | Hashed from IP + User-Agent — pseudonymous, not reversible to a real IP |
| IP | `192.168.xxx.xxx` | Last two octets masked |
| Country | `India` | From CDN/proxy geo headers if present |
| Browser / OS / Device | `Chrome 139` / `Windows 10/11` / `Desktop` | Parsed from User-Agent |
| Page / Method | `/api/email-check` / `POST` | Standard request metadata |
| SearchType | `Email` | Which check was run |
| **InputSubmitted** | `t***@gmail.com` | **Always masked** — password is never logged in any form; email/phone show only a small fragment |
| Result / ResponseTimeMs / Status | `OK` / `1200` / `200` | Outcome and performance |

This gives real usage analytics (who's using it, how often, from where, how fast) without ever storing a visitor's actual password, full email, or full phone number.

### Downloading logs

Set `LOGS_ACCESS_KEY` in your `.env` (any random string), then download the CSV anytime at:
```
https://your-deployed-url/api/logs?key=<your LOGS_ACCESS_KEY>
```

### Making logs persistent (survive server restarts)

The local `check_logs.csv` lives on the server's filesystem — on free hosts like Render, that's **ephemeral** and gets wiped on every restart/redeploy. To keep data permanently, this project can also mirror every log row into a **private GitHub repo** via the GitHub API:

1. Create a private repo to hold the logs (e.g. `exposure-check-logs`)
2. Generate a fine-grained GitHub token scoped to *only* that repo, with **Contents: Read and write**
3. Set these environment variables:
   - `GITHUB_LOG_TOKEN` — the token from step 2
   - `GITHUB_LOG_REPO` — e.g. `yourusername/exposure-check-logs`
4. Redeploy. From then on, every check event is committed to that repo's `check_logs.csv`, safe from restarts — view or download it directly from GitHub anytime.

This write happens fire-and-forget (it never blocks or slows down the response to the actual visitor), and retries once on a write conflict if two requests land at nearly the same time.

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
