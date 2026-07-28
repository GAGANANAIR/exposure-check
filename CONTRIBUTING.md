# Contributing to Exposure Check

Thanks for considering a contribution! A few things to keep in mind given what this project is.

## The core privacy principle

This tool exists so people can check their **own** password/email/phone privately. Any contribution that would make it easier to look up *someone else's* data, or that would log/store real unmasked passwords, emails, or phone numbers, won't be accepted — that's a hard boundary for this project, not a style preference.

## Good contributions

- Adding another free breach/validation data source
- Improving the masking logic in `middleware/logger.js` (e.g. smarter email/phone masking)
- Adding a persistent storage backend option (Supabase, Redis, etc.) as an alternative to the GitHub-based logger
- UI/UX improvements to `public/`
- Better rate-limiting or caching strategies

## Before submitting a PR

- Test locally with `npm start` and confirm `check_logs.csv` never contains an unmasked password/email/phone
- If you touch `middleware/logger.js` or `middleware/githubLogger.js`, double check the masking functions still redact properly
- Keep `.env.example` up to date if you add new environment variables — never commit a real `.env`
