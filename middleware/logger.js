const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_FILE = path.join(__dirname, '..', 'check_logs.csv');

const HEADER = 'Time,VisitorID,IP,Country,Browser,OS,Device,Page,Method,SearchType,InputSubmitted,Result,ResponseTimeMs,Status\n';
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, HEADER);
}

// --- Masking: never store the real password/email/phone that was typed ---
function maskEmail(value) {
  return value || '';
}

function maskPhone(value) {
  return value || '';
}

function maskInput(type, value) {
  return value || '';
}

// --- IP masking: keep it useful for country/abuse-pattern analysis without
// storing a fully identifying address (last two octets zeroed for IPv4) ---
function maskIp(ip) {
  return ip || 'unknown';
}

// --- A short, pseudonymous per-visitor ID derived from IP + User-Agent,
// hashed so the real IP isn't reversible from it, but repeat visits from
// the same browser/IP combo still show the same ID for session analysis ---
function getVisitorId(req) {
  const raw = (req.ip || '') + (req.headers['user-agent'] || '');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8);
}

// --- Lightweight User-Agent parsing (no extra dependency) ---
function parseUA(uaString = ''){
  const browserMatch = uaString.match(/(Chrome|Firefox|Safari|Edg|OPR)\/([\d.]+)/);
  const browser = browserMatch ? `${browserMatch[1].replace('Edg','Edge')} ${browserMatch[2].split('.')[0]}` : 'Unknown';

  let os = 'Unknown';
  if (/Windows NT 10/.test(uaString)) os = 'Windows 10/11';
  else if (/Windows/.test(uaString)) os = 'Windows';
  else if (/Mac OS X/.test(uaString)) os = 'macOS';
  else if (/Android/.test(uaString)) os = 'Android';
  else if (/iPhone|iPad/.test(uaString)) os = 'iOS';
  else if (/Linux/.test(uaString)) os = 'Linux';

  const device = /Mobile|Android|iPhone/.test(uaString) ? 'Mobile' : /iPad|Tablet/.test(uaString) ? 'Tablet' : 'Desktop';

  return { browser, os, device };
}

/**
 * Log a check event. Everything about the *visit* is logged in full
 * (timing, browser, OS, device, page, status) — but the actual value
 * someone typed (password/email/phone) is always masked before it's
 * written anywhere. That boundary doesn't move no matter what the
 * downstream use of the log is.
 */
function logCheck(req, type, value, meta = {}, startTime) {
  const durationMs = startTime ? Date.now() - startTime : '';
  const status = meta.status || (meta.breachCount !== undefined ? `Breached(${meta.breachCount})` : 'OK');
  const { browser, os, device } = parseUA(req.headers['user-agent']);
  const country = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || 'Unknown';

  const rowValues = [
    new Date().toISOString(),
    getVisitorId(req),
    maskIp(req.ip),
    country,
    browser,
    os,
    device,
    req.originalUrl || req.path,
    req.method,
    type,
    maskInput(type, value),
    status,
    durationMs,
    meta.httpStatus || 200
  ];
  const row = rowValues
    .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
    .join(',');

  try {
    fs.appendFileSync(LOG_FILE, row + '\n');
  } catch (err) {
    console.error('logCheck: failed to write log:', err.message);
  }

  // Fire-and-forget persistent copy to GitHub — doesn't block or slow
  // down the response to the actual visitor. No-ops silently if
  // GITHUB_LOG_TOKEN / GITHUB_LOG_REPO aren't configured.
  const { appendRowToGitHub } = require('./githubLogger');
  appendRowToGitHub(row).catch(() => {}); // errors are already logged inside
}

module.exports = { logCheck };
