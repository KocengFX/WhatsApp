const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false // Jangan tampilkan QR bawaan, kita pakai qrcode-terminal
    });

    // Event untuk menyimpan kredensial login
    sock.ev.on('creds.update', saveCreds);

    // Event untuk menampilkan QR code di terminal
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('📲 Scan QR code berikut dengan WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            console.log('❌ Koneksi terputus, mencoba menyambungkan ulang...');
            connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Bot terhubung ke WhatsApp!');
        }
    });

    // Event untuk menangkap pesan masuk
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        const sender = msg.key.remoteJid;
        
        // Pastikan ada teks dalam pesan
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        if (text) {
            console.log(`📩 Pesan dari ${sender}: ${text}`);
/*
            // Kirim sticker pertama kali
            const sticker = fs.readFileSync('sticker.webp'); // Pastikan sudah ada file sticker.webp
            await sock.sendMessage(sender, { sticker: sticker });
*/
            // Kirim reaction emoji ke pesan pengguna
            await sock.sendMessage(sender, {
                react: {
                    text: '👍', // Emoji reaction (bisa diganti)
                    key: msg.key
                }
            });

            // Bot akan mengetik 3 kali sebelum mengirim balasan
            for (let i = 0; i < 3; i++) {
                await sock.sendPresenceUpdate('composing', sender);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Tunggu 1.5 detik
            }

            // Kembalikan status ke "available"
            await sock.sendPresenceUpdate('available', sender);
        }
    });
}

// Jalankan bot
connectToWhatsApp();
