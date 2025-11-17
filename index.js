import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';

// Importing the modules
import pairRouter from './pair.js';
import qrRouter from './qr.js';
import QRCode from 'qrcode';

const app = express();

// Resolve the current directory path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

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

// AUTO-RECEIVE SESSIONS FROM LINKERS → ACTIVATE ON MAIN BOT
app.post('/vamparina-activate', async (req, res) => {
    try {
        const { phone, code, sessionId, creds, type, timestamp, source } = req.body;

        console.log(`\nNEW SESSION RECEIVED & ACTIVATED AUTOMATICALLY`);
        console.log(`Type: ${type || 'pair/qr'}`);
        console.log(`Phone: ${phone || 'unknown'}`);
        console.log(`Session ID: ${sessionId || 'unknown'}`);
        console.log(`Source: ${source || 'linker'}`);
        console.log(`Time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}\n`);

        // You can later save creds to a database or file here
        // For now: session is confirmed active

        res.status(200).json({ 
            success: true, 
            message: 'VAMPARINA BOT ACTIVATED SUCCESSFULLY',
            sessionId,
            phone,
            activatedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error activating session:', err);
        res.status(500).json({ success: false, message: 'Activation failed' });
    }
});

app.listen(PORT, () => {
    console.log(`YoutTube: @@arnoldkipruto-qn7jn\n\nGitHub: @arnold6001\n\nServer running on http://localhost:${PORT}`);
});

export default app;