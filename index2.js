/**
 * =============================================================================
 *  WHATSAPP PRIVATE BOT — NONSTOP PRESENCE + AUTO VIEW STATUS + AUTO REACTION
 *  FIXED VERSION (BAILEYS NEW API) - BY KOCENG
 * =============================================================================
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');

// ===========================
// Fitur ON/OFF
// ===========================
const FEATURE = {
  ALWAYS_COMPOSING: true,        // Mengetik terus
  ALWAYS_RECORDING: false,       // Merekam terus
  AUTO_VIEW_STATUS: true,        // Lihat story otomatis
  AUTO_REACTION: false,           // Reaction otomatis

  SET_PRESENCE_MODE: "composing" // composing / recording
};

// ===========================
const AUTH_DIR = 'auth_info';
const EMOJIS = ['🔥','❤️','🤣','😎','👏','💯','😍','🤝','⚡','🥳','😮'];

const reactLoops = new Map();
const presenceLoops = new Map();


// ===================================================================
// Helper
// ===================================================================
function randomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}


// ===================================================================
// NONSTOP TYPING / RECORDING (FIXED)
// ===================================================================
function ensurePresenceLoop(sock, jid) {
  if (!FEATURE.ALWAYS_COMPOSING && !FEATURE.ALWAYS_RECORDING) return;
  if (jid.endsWith('@g.us')) return; // jangan grup
  if (!jid.includes('@s.whatsapp.net')) return;

  if (presenceLoops.has(jid)) return;

  const mode = FEATURE.SET_PRESENCE_MODE;
  let lastSubscribe = Date.now();

  const interval = setInterval(async () => {
    try {
      // subscribe tiap 7 detik (WA limit)
      if (Date.now() - lastSubscribe > 7000) {
        await sock.presenceSubscribe(jid).catch(() => {});
        lastSubscribe = Date.now();
      }

      await sock.sendPresenceUpdate(mode, jid).catch(() => {});
    } catch {}
  }, 2000);

  presenceLoops.set(jid, interval);
  console.log(`🟢 PRESENCE "${mode}" nonstop → ${jid}`);
}


// ===================================================================
// AUTO VIEW STATUS
// ===================================================================
async function autoViewStatus(sock, key) {
  if (!FEATURE.AUTO_VIEW_STATUS) return;
  try {
    await sock.readMessages([key]);
    console.log("👁️ Story dilihat.");
  } catch {}
}


// ===================================================================
// AUTO REACTION (FIXED STRUCTURE)
// ===================================================================
function startReaction(sock, key) {
  if (!FEATURE.AUTO_REACTION) return;

  const id = key.id;
  if (!id || reactLoops.has(id)) return;

  const interval = setInterval(async () => {
    try {
      await sock.sendMessage(key.remoteJid, {
        react: {
          text: randomEmoji(),
          key: {
            remoteJid: key.remoteJid,
            id: key.id,
            fromMe: key.fromMe || false
          }
        }
      });
    } catch {}
  }, 2000 + Math.random() * 1500);

  reactLoops.set(id, interval);
  console.log(`😆 REACTION LOOP → ${key.remoteJid}`);
}


// ===================================================================
// MAIN CONNECTION
// ===================================================================
async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['PrivateBot', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  // QR
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });

    if (connection === 'open') {
      console.log('✅ Bot Online');
    }

    if (connection === 'close') {
      const err = lastDisconnect?.error;

      const conflict =
        err?.output?.statusCode === DisconnectReason.connectionReplaced ||
        (err?.message || '').toLowerCase().includes("conflict");

      if (conflict) {
        console.log('🛑 Sesi dipakai di perangkat lain.');
        return process.exit(0);
      }

      console.log('🔁 Reconnect 3 detik...');
      setTimeout(connect, 3000);
    }
  });

  // PESAN MASUK
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages?.length) return;

    for (const msg of messages) {
      const { key } = msg;
      if (!key || key.fromMe) continue;

      const jid = key.remoteJid;
      if (!jid) continue;

      // Story
      if (jid === 'status@broadcast') {
        await autoViewStatus(sock, key);
        continue;
      }

      // Nonstop Typing / Recording
      ensurePresenceLoop(sock, jid);

      // Auto Reaction
      startReaction(sock, key);
    }
  });
}


// Start
connect();
