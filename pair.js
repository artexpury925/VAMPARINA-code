import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';

const router = express.Router();

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
    let dirs = './' + (num ? `session_\( {num}` : `session_ \){Date.now()}`);

    // Remove old session
    await removeFile(dirs);

    num = num?.replace(/[^0-9]/g, '');

    const phone = pn('+' + num);
    if (!phone.isValid()) {
        return res.status(400).json({ 
            error: "Invalid phone number. Use full international format (e.g., +254703110780)" 
        });
    }

    num = phone.getNumber('e164').replace('+', '');

    async function initiateSession() {
        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        try {
            const { version } = await fetchLatestBaileysVersion();

            const MUZAN = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.windows('Chrome'),
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
            });

            MUZAN.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    console.log(`✅ MUZAN MD Connected Successfully → ${num}`);

                    try {
                        const credsPath = `${dirs}/creds.json`;
                        const sessionData = fs.readFileSync(credsPath);

                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

                        // Send creds.json
                        await MUZAN.sendMessage(userJid, {
                            document: sessionData,
                            mimetype: 'application/json',
                            fileName: 'creds.json'
                        });

                        // Send setup guide
                        await MUZAN.sendMessage(userJid, {
                            image: { url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' },
                            caption: `🎬 *MUZAN MD Full Setup Guide*\n\nWatch Now: https://youtu.be/-oz_u1iMgf8`
                        });

                        // Thank you message
                        await MUZAN.sendMessage(userJid, {
                            text: `✅ *MUZAN MD Successfully Connected!*\n\n⚠️ *Do not share creds.json with anyone.*\n\n© 2025 Arnold Der Abenteurer`
                        });

                        console.log("✅ All files sent successfully");

                    } catch (err) {
                        console.error("Error sending files:", err);
                    }

                    // Cleanup
                    await delay(5000);
                    removeFile(dirs);
                }

                if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    if (shouldReconnect) {
                        console.log("🔄 Reconnecting...");
                        setTimeout(initiateSession, 5000);
                    }
                }
            });

            // Request Pairing Code
            if (!MUZAN.authState.creds.registered) {
                await delay(3000);
                let code = await MUZAN.requestPairingCode(num);
                code = code?.match(/.{1,4}/g)?.join('-') || code;

                if (!res.headersSent) {
                    res.json({ code });
                }
            }

            MUZAN.ev.on('creds.update', saveCreds);

        } catch (err) {
            console.error('Session Error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to start session" });
            }
        }
    }

    await initiateSession();
});

// Keep process alive
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

export default router;