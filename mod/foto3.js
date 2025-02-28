const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const profilePicDir = 'profile_pics'; // Folder untuk foto profil baru

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
            setTimeout(connectToWhatsApp, 5000);
        } else if (connection === 'open') {
            console.log('✅ Bot terhubung ke WhatsApp!');
            changeProfilePicture(sock); // Ganti foto profil satu kali
        }
    });
}

async function changeProfilePicture(sock) {
    if (!fs.existsSync(profilePicDir)) {
        fs.mkdirSync(profilePicDir);
    }

    try {
        const files = fs.readdirSync(profilePicDir).filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'));
        if (files.length === 0) {
            console.log('❌ Tidak ada gambar di folder profile_pics.');
            return;
        }

        const randomImage = path.join(profilePicDir, files[Math.floor(Math.random() * files.length)]);
        console.log(`🔄 Mengganti foto profil dengan: ${randomImage}`);

        const imageBuffer = fs.readFileSync(randomImage);
        const mimeType = mime.lookup(randomImage) || 'image/jpeg';

        await sock.updateProfilePicture(sock.user.id, { mimetype: mimeType, data: imageBuffer });
        console.log('✅ Foto profil berhasil diganti!');

        process.exit(0);
    } catch (err) {
        console.error('❌ Gagal mengganti foto profil:', err.message);
        process.exit(1);
    }
}

// Jalankan bot
connectToWhatsApp();
