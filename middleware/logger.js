const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'check_logs.csv');

if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, 'Timestamp,Type,MaskedInput,Status,DurationMs\n');
}

// Mask an email, keeping only the first character and the domain —
// e.g. "j***@gmail.com" — enough to spot patterns without storing
// someone's real address.
function maskEmail(value) {
  if (!value || !value.includes('@')) return '********';
  const [local, domain] = value.split('@');
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

// Mask a phone number, keeping only the leading country-code-ish prefix
// and the last 2 digits — e.g. "+91******90".
function maskPhone(value) {
  if (!value) return '********';
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length || 4);
  const prefix = value.startsWith('+') ? value.slice(0, 3) : digits.slice(0, 2);
  const suffix = digits.slice(-2);
  return `${prefix}${'*'.repeat(Math.max(digits.length - 4, 2))}${suffix}`;
}

function maskValue(type, value) {
  if (type === 'Password') return '********'; // never log any part of a password
  if (type === 'Email') return maskEmail(value);
  if (type === 'Phone') return maskPhone(value);
  return '********';
}

/**
 * Log a check event without ever storing the real, unmasked input.
 * This is aggregate/diagnostic logging only — not analytics on identifiable
 * user data, and it never includes anything that could reconstruct the
 * original password, email, or phone number that was checked.
 */
function logCheck(req, type, value, meta = {}, startTime) {
  const durationMs = startTime ? Date.now() - startTime : '';
  const status = meta.status || (meta.breachCount !== undefined ? `Breached(${meta.breachCount})` : 'OK');
  const masked = maskValue(type, value);

  const row = [
    new Date().toISOString(),
    type,
    masked,
    status,
    durationMs
  ]
    .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',');

  try {
    fs.appendFileSync(LOG_FILE, row + '\n');
  } catch (err) {
    console.error('logCheck: failed to write log:', err.message);
  }
}

module.exports = { logCheck };
