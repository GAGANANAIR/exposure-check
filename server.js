require('dotenv').config();
const express = require('express');
const path = require('path');

const rateLimit = require('./middleware/rateLimit');
const passwordRoute = require('./routes/password');
const emailRoute = require('./routes/email');
const phoneRoute = require('./routes/phone');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Log all visits
app.use((req, res, next) => {
  if (req.path === '/' || req.path.startsWith('/api')) {
    const { logCheck } = require('./middleware/logger');
    logCheck(req, 'Visit', req.path);
  }
  next();
});

// API Routes with Rate Limiting
app.use('/api/password-check', rateLimit, passwordRoute);
app.use('/api/email-check', rateLimit, emailRoute);
app.use('/api/phone-check', rateLimit, phoneRoute);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    numverifyEnabled: Boolean(process.env.NUMVERIFY_API_KEY),
  });
});

// Simple Log Viewer Page (Protected by basic password)
app.get('/admin/logs', (req, res) => {
  const pass = req.query.pass;
  if (pass !== 'your-secret-password') {  // ← Change this!
    return res.status(401).send('Unauthorized');
  }

  const fs = require('fs');
  const logPath = path.join(__dirname, 'logs/user-checks.log');
  if (fs.existsSync(logPath)) {
    const logs = fs.readFileSync(logPath, 'utf8');
    res.send(`<pre>${logs}</pre><a href="/admin/logs?pass=your-secret-password">Refresh</a>`);
  } else {
    res.send('No logs yet.');
  }
});

app.listen(PORT, () => {
  console.log(`Exposure checker running at http://localhost:${PORT}`);
  console.log(`Log viewer: http://localhost:${PORT}/admin/logs?pass=your-secret-password`);
  console.log(
    process.env.NUMVERIFY_API_KEY
      ? 'NumVerify: enabled'
      : 'NumVerify: disabled (set NUMVERIFY_API_KEY in .env)'
  );
});
