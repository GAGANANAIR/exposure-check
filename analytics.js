const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const FILE = path.join(__dirname, "..", "visitor_logs.csv");

// Create CSV if it doesn't exist
if (!fs.existsSync(FILE)) {
    fs.writeFileSync(
        FILE,
        "Timestamp,Browser,OS,Device,Resolution,Page,Referrer,SessionID\n"
    );
}

router.post("/visit", (req, res) => {
    const {
        browser,
        os,
        device,
        resolution,
        page,
        referrer,
        session
    } = req.body;

    const row = [
        new Date().toISOString(),
        browser,
        os,
        device,
        resolution,
        page,
        referrer,
        session
    ]
        .map(v => `"${String(v || "").replace(/"/g, '""')}"`)
        .join(",");

    fs.appendFileSync(FILE, row + "\n");

    res.json({
        success: true
    });
});

module.exports = router;
