const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const LOG_FILE = path.join(__dirname, '..', 'check_logs.csv');

// Simple shared-secret protection: set LOGS_ACCESS_KEY in your .env,
// then visit /api/logs?key=<that value> to download the CSV.
router.get('/', (req, res) => {
  const key = req.query.key;
  if (!process.env.LOGS_ACCESS_KEY || key !== process.env.LOGS_ACCESS_KEY) {
    return res.status(403).json({ error: 'Invalid or missing access key.' });
  }
  if (!fs.existsSync(LOG_FILE)) {
    return res.status(404).json({ error: 'No log file yet — no checks have been run.' });
  }
  res.download(LOG_FILE, 'check_logs.csv');
});

module.exports = router;
