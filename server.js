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

// Rate limiting only applies to the API endpoints that hit external services —
// serving the static frontend stays unlimited.
app.use('/api/password-check', rateLimit, passwordRoute);
app.use('/api/email-check', rateLimit, emailRoute);
app.use('/api/phone-check', rateLimit, phoneRoute);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    numverifyEnabled: Boolean(process.env.NUMVERIFY_API_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`Exposure checker running at http://localhost:${PORT}`);
  console.log(
    process.env.NUMVERIFY_API_KEY
      ? 'NumVerify phone enrichment: enabled'
      : 'NumVerify phone enrichment: disabled (set NUMVERIFY_API_KEY in .env to enable)'
  );
});
