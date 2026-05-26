import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { delay } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

const router = express.Router();

function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        fs.rmSync(FilePath, { recursive: true, force: true });
        return true;
    } catch (e) {
        console.error('Error removing file:', e);
        return false;
    }
}

router.get('/', async (req, res) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const dirs = `./qr_sessions/session_${sessionId}`;

    if (!fs.existsSync('./qr_sessions')) {
        fs.mkdirSync('./qr_sessions', { recursive: true });
    }

    async function initiateSession() {
        if (!fs.existsSync(dirs)) fs.mkdirSync(dirs, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(dirs);

        let qrGenerated = false;
        let responseSent = false;

        const handleQRCode = async (qr) => {
            if (qrGenerated || responseSent) return;
            qrGenerated = true;

            try {
                const qrDataURL = await QRCode.toDataURL(qr, {
                    errorCorrectionLevel: 'M',
                    margin: 2,
                    color: { dark: '#000000', light: '#FFFFFF' }
                });

                if (!responseSent) {
                    responseSent = true;
                    res.json({
                        qr: qrDataURL,
                        message: 'Scan this QR to connect MUZAN MD',
                        instructions: [
                            '1. Open WhatsApp on your phone',
                            '2. Go to Settings > Linked Devices',
                            '3. Tap "Link a Device"',
                            '4. Scan the QR code above'
                        ]
                    });
                }
            } catch (qrError) {
                console.error('QR Generation Error:', qrError);
                if (!responseSent) {
                    responseSent = true;
                    res.status(500).json({ error: 'Failed to generate QR code' });
                }
            }
        };

        try {
            const { version } = await fetchLatestBaileysVersion();

            const MUZAN = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                browser: Browsers.windows('Chrome'),
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                markOnlineOnConnect: false,
                generateHighQualityLinkPreview: false,
            });

            MUZAN.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr && !qrGenerated) {
                    await handleQRCode(qr);
                }

                if (connection === 'open') {
                    console.log(`✅ MUZAN MD Connected Successfully!`);

                    try {
                        const credsPath = `${dirs}/creds.json`;
                        const sessionData = fs.readFileSync(credsPath);

                        const userJid = jidNormalizedUser(MUZAN.user?.id || '');

                        if (userJid) {
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
                                text: `✅ *MUZAN MD Successfully Activated!*\n\n⚠️ Do not share this creds.json file with anyone.\n\n© 2025 Arnold Der Abenteurer`
                            });
                        }
                    } catch (err) {
                        console.error("Error sending files:", err);
                    }

                    // Cleanup
                    setTimeout(() => removeFile(dirs), 15000);
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode !== 401) {
                        console.log("🔄 Reconnecting...");
                    } else {
                        removeFile(dirs);
                    }
                }
            });

            MUZAN.ev.on('creds.update', saveCreds);

            // Timeout safety
            setTimeout(() => {
                if (!responseSent) {
                    responseSent = true;
                    res.status(408).json({ error: 'QR generation timeout' });
                    removeFile(dirs);
                }
            }, 45000);

        } catch (err) {
            console.error('Session Error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to start session' });
            }
            removeFile(dirs);
        }
    }

    await initiateSession();
});

// Global handlers
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

export default router;