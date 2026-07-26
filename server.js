require('dotenv').config();
const express = require('express');
const path = require('path');

const rateLimit = require('./middleware/rateLimit');
const passwordRoute = require('./routes/password');
const emailRoute = require('./routes/email');
const phoneRoute = require('./routes/phone');
const logsRoute = require('./routes/logs');
const { logCheck } = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Log page visits (no input value involved, so nothing to mask here)
app.use((req, res, next) => {
  if (req.path === '/' || req.path.startsWith('/api')) {
    logCheck(req, 'Visit', null, {}, Date.now());
  }
  next();
});

// API Routes with Rate Limiting
app.use('/api/password-check', rateLimit, passwordRoute);
app.use('/api/email-check', rateLimit, emailRoute);
app.use('/api/phone-check', rateLimit, phoneRoute);

// Log download — requires LOGS_ACCESS_KEY set in your own .env,
// never a hardcoded value committed to the repo. Usage:
// /api/logs?key=<your LOGS_ACCESS_KEY value>
app.use('/api/logs', logsRoute);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    numverifyEnabled: Boolean(process.env.NUMVERIFY_API_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`Exposure checker running at http://localhost:${PORT}`);
  console.log(
    process.env.LOGS_ACCESS_KEY
      ? 'Log download: enabled at /api/logs?key=<your LOGS_ACCESS_KEY>'
      : 'Log download: disabled (set LOGS_ACCESS_KEY in .env to enable)'
  );
  console.log(
    process.env.NUMVERIFY_API_KEY
      ? 'NumVerify: enabled'
      : 'NumVerify: disabled (set NUMVERIFY_API_KEY in .env)'
  );
});
