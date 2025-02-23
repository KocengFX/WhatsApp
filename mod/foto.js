const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

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
            // Menunggu 5 detik sebelum mencoba sambung lagi
            setTimeout(connectToWhatsApp, 5000);
        } else if (connection === 'open') {
            console.log('✅ Bot terhubung ke WhatsApp!');
            startProfilePictureUpdater(sock); // Mulai ganti foto profil secara berkala
        }
    });

    // Fungsi mengganti foto profil tanpa batasan waktu
    async function startProfilePictureUpdater(sock) {
        if (!fs.existsSync(profilePicDir)) {
            fs.mkdirSync(profilePicDir);
        }

        while (true) { // Loop tanpa henti
            try {
                const files = fs.readdirSync(profilePicDir).filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'));
                if (files.length === 0) {
                    console.log('❌ Tidak ada gambar di folder profile_pics.');
                    return;
                }

                const randomImage = path.join(profilePicDir, files[Math.floor(Math.random() * files.length)]);
                console.log(`🔄 Mengganti foto profil dengan: ${randomImage}`);

                const imageBuffer = fs.readFileSync(randomImage);
                await sock.updateProfilePicture(sock.user.id, { url: randomImage });
                console.log('✅ Foto profil berhasil diganti!');

                // Tunggu selama 15 detik sebelum mengganti foto profil lagi
                await new Promise(resolve => setTimeout(resolve, 15000)); 
            } catch (err) {
                console.error('❌ Gagal mengganti foto profil:', err.message);
            }
        }
    }
}

// Jalankan bot
connectToWhatsApp();
