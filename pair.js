import express from 'express';
import fs from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pn from 'awesome-phonenumber';

const router = express.Router();

// Directories
const SESSION_DIR = './auto_sessions';
const TEMP_DIR = './temp_sessions';

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function removeFile(path) {
  try {
    if (fs.existsSync(path)) {
      fs.rmSync(path, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('Cleanup error:', e);
  }
}

router.get('/', async (req, res) => {
  let num = req.query.number?.trim();
  if (!num) return res.status(400).send({ error: "Missing number parameter" });

  const tempDir = `${TEMP_DIR}/${num}_${Date.now()}`;
  removeFile(tempDir); // Clean old temp

  // Clean number
  num = num.replace(/[^0-9]/g, '');
  const phone = pn('+' + num);
  if (!phone.isValid()) {
    return res.status(400).json({ error: "Invalid phone number. Use full international format without + or spaces." });
  }
  num = phone.getNumber('e164').slice(1); // Remove +

  async function startPairing() {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);

    const sock = makeWASocket({
      version: (await fetchLatestBaileysVersion()).version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
      },
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers.windows('Chrome'),
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        console.log(`Linked successfully: ${num}`);

        try {
          // === SAVE SESSION PERMANENTLY FOR MAIN BOT ===
          const sessionId = `vamp_${num}_${Date.now()}`;
          const finalPath = `${SESSION_DIR}/${sessionId}`;
          fs.mkdirSync(finalPath, { recursive: true });
          fs.cpSync(tempDir, finalPath, { recursive: true });

          console.log(`Session saved: ${sessionId}`);
          console.log(`Main bot can now fetch it at: https://vamparina-code.onrender.com/api/creds/${sessionId}`);

          // === SEND FILE TO USER ===
          const userJid = `${num}@s.whatsapp.net`;
          await sock.sendMessage(userJid, {
            document: fs.readFileSync(`${finalPath}/creds.json`),
            mimetype: 'application/json',
            fileName: 'creds.json'
          });

          await sock.sendMessage(userJid, {
            image: { url: 'https://img.youtube.com/vi/-oz_u1iMgf8/maxresdefault.jpg' },
            caption: `*VAMPARINA MD V2.0 Full Setup Guide!*\n\nBug Fixes + New Commands + Fast AI Chat\nWatch Now: https://youtu.be/-oz_u1iMgf8`
          });

          await sock.sendMessage(userJid, {
            text: `Do not share this file with anybody\n\nThanks for using VAMPARINA\n©2025 Arnold Chirchir | +254703110780`
          });

        } catch (err) {
          console.error("Failed to send file:", err);
        } finally {
          // Clean temp folder
          await delay(2000);
          removeFile(tempDir);
          sock.ws.close?.();
        }
      }

      if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
        console.log("Retrying connection...");
        startPairing();
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // Request pairing code
    if (!sock.authState.creds.registered) {
      await delay(3000);
      const code = await sock.requestPairingCode(num);
      const formatted = code.match(/.{1,4}/g)?.join('-') || code;
      res.json({ code: formatted });
    }
  }

  startPairing().catch(console.error);
});

export default router;