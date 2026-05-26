import express from 'express';
import bodyParser from 'body-parser';
import { fileURLToPath } from 'url';
import path from 'path';

// Importing the routers
import pairRouter from './pair.js';
import qrRouter from './qr.js';

const app = express();

// Resolve current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

// Increase event listeners limit
import('events').then(events => {
    events.EventEmitter.defaultMaxListeners = 500;
});

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.use('/pair', pairRouter);
app.use('/qr', qrRouter);

// Start Server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║           MUZAN MD WHATSAPP LINKER         ║
║              AUTO ACTIVATION ENABLED       ║
╚════════════════════════════════════════════╝

Owner     : Arnold Der Abenteurer
YouTube   : Arnold Der Abenteurer
GitHub    : artexpury

Server successfully running on → http://localhost:${PORT}
    `);
});

export default app;