const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const logFile = 'messages_log.json';  // File untuk menyimpan pesan terakhir dari setiap pengirim

let isRecording = true; // Variabel global untuk melanjutkan status
let isComposing = false; // Variabel global untuk status mengetik
let intervalId = null; // Variabel untuk menyimpan interval
let allSenders = {}; // Menyimpan semua pengirim yang aktif

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
            // Baca log terakhir untuk melanjutkan status
            loadMessages(sock);
        }
    });

    // Event untuk menangkap pesan masuk
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        const currentSender = msg.key.remoteJid;  // Simpan sender untuk digunakan pada interval
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        // Cek apakah pesan berasal dari grup
        if (currentSender.endsWith('@g.us')) {
            console.log(`🚫 Pesan dari grup (${currentSender}) diabaikan.`);
            return; // Jangan lanjutkan eksekusi jika dari grup
        }

        if (text) {
            console.log(`📩 Pesan dari ${currentSender}: ${text}`);

            // Simpan pesan terbaru untuk pengirim yang sama
            saveMessage(currentSender, text);

            // Kirim reaction emoji ke pesan pengguna
            await sock.sendMessage(currentSender, {
                react: {
                    text: '👍', // Emoji reaction (bisa diganti)
                    key: msg.key
                }
            });
        }
    });

    // Mulai status mengetik dan merekam untuk semua pengirim yang ada
    function startTypingAndRecording(sock) {
        if (intervalId) {
            clearInterval(intervalId); // Pastikan interval lama dihentikan
        }

        intervalId = setInterval(async () => {
            try {
                if (Object.keys(allSenders).length > 0) {
                    // Untuk setiap sender aktif, kirimkan status yang sesuai
                    for (const sender of Object.keys(allSenders)) {
                        if (allSenders[sender].isRecording) {
                            // Mengirim status "recording"
                            await sock.sendPresenceUpdate('recording', sender);
                        }

                        if (allSenders[sender].isComposing) {
                            // Mengirim status "composing"
                            await sock.sendPresenceUpdate('composing', sender);
                        }
                    }
                } else {
                    console.log('Tidak ada pengirim aktif.');
                }
            } catch (err) {
                console.error('Error saat mengirim status: ', err);
            }
        }, 2500); // Interval 2.5 detik untuk berganti status
    }

    // Fungsi untuk menyimpan pesan terbaru dari pengirim yang sama
    function saveMessage(sender, text) {
        let allMessages = {};

        // Cek apakah file log sudah ada
        if (fs.existsSync(logFile)) {
            const logData = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            allMessages = logData.messages || {};
        }

        // Simpan pesan terbaru dari pengirim yang sama
        allMessages[sender] = {
            sender: sender,
            text: text,
            timestamp: new Date().toISOString()
        };

        // Simpan kembali objek pesan ke dalam file JSON
        fs.writeFileSync(logFile, JSON.stringify({ messages: allMessages }, null, 2));

        // Simpan pengirim aktif dengan status
        allSenders[sender] = { isRecording: true, isComposing: false }; // Set status default
    }

    // Fungsi untuk membaca pesan terakhir dari log dan status pengirim
    function loadMessages(sock) {
        if (fs.existsSync(logFile)) {
            const logData = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            const messages = logData.messages || {};

            if (Object.keys(messages).length > 0) {
                // Ambil semua pengirim dan status mereka
                for (const sender of Object.keys(messages)) {
                    allSenders[sender] = { isRecording: true, isComposing: false }; // Set status default
                }
                console.log(`🔄 Melanjutkan dari ${Object.keys(messages).length} pengirim.`);
            } else {
                console.log('📝 Tidak ada pesan yang disimpan.');
            }

            // Lanjutkan status mengetik dan merekam
            startTypingAndRecording(sock);
        } else {
            console.log('📝 Tidak ada pesan yang disimpan.');
            // Jika tidak ada log, mulai dari awal
            startTypingAndRecording(sock);
        }
    }
}

// Jalankan bot
connectToWhatsApp();
