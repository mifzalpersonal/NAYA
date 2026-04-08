const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const axios = require("axios");

async function startBot() {
  // 1. Setup Auth
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  // 2. Ambil versi WA terbaru biar gak gampang DC
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "error" }), // Ubah ke error biar tau kalau ada masalah fatal
    printQRInTerminal: false, // Kita handle manual di bawah
    browser: ["Windows", "Chrome", "11.0.0"], // Identitas bot
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("--- SCAN QR DI BAWAH INI ---");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message;

      console.log(`Koneksi Close: ${reason} (${statusCode})`);

      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log("Mencoba hubungkan kembali dalam 5 detik...");
        setTimeout(() => startBot(), 5000); // Kasih delay biar gak spamming loop
      }
    } else if (connection === "open") {
      console.log("Bot sudah online! ✅");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const messageText =
      m.message.conversation || m.message.extendedTextMessage?.text || "";
    const lowerText = messageText.toLowerCase();
    const sender = m.key.remoteJid;

    // fitur 1
    if (messageText.toLowerCase() === "ping") {
      await sock.sendPresenceUpdate("composing", sender);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await sock.sendMessage(m.key.remoteJid, { text: "Pong!" });
    }

    // fitur 2
    else if (lowerText === ".jadwal") {
      await sock.sendPresenceUpdate("composing", sender);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const listJadwal = `*📅 JADWAL XI PPLG 1*
        1. Senin : PKK
        2. Selasa : MTK, Agama, B Sunda
        3. Rabu : B Inggris, PPKN
        4. Kamis : PKK, Agama, B Indonesia
        5. Jumat : Penjas, Sejarah, B Inggris`;

      await sock.sendMessage(sender, { text: listJadwal });
    }

    // fitur 3 masih experimental
    else if (lowerText.startsWith(".ingetin ")) {
      await sock.sendPresenceUpdate("composing", sender);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const parts = messageText.split(" ");
      const menit = parseInt(parts[1]);
      const pesan = parts.slice(2).join(" ");

      if (isNaN(menit) || !pesan) {
        return await sock.sendMessage(sender, {
          text: "Format salah! Contoh: *.ingetin 5 beli kopi*",
        });
      }

      await sock.sendMessage(sender, {
        text: `Siap! ${menit} menit lagi gue ingetin: *${pesan}*`,
      });

      setTimeout(
        async () => {
          await sock.sendMessage(sender, {
            text: `🔔 *REMINDER!* 🔔\n\n_"${pesan}"_`,
          });
        },
        menit * 60 * 1000,
      );
    }

    // fitur 4 tes perbedaan lowertext dan message text sama fitur 5
    else if (lowerText.startsWith(".kamu sayang aku ga")) {
      await sock.sendMessage(m.key.remoteJid, { text: "sayang koo" });
    }

    // fitur 5
    else if (messageText.toLowerCase() === "sayang?") {
      await sock.sendPresenceUpdate("composing", sender);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await sock.sendMessage(m.key.remoteJid, { text: "iya kenapa?" });
    }

    // fitur 6
    if (messageText.includes("tiktok.com")) {
      await sock.sendPresenceUpdate("composing", sender);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      await sock.sendMessage(sender, {
        text: "Sabar ya, lagi diambilin videonya...",
      });

      try {
        // Menggunakan API lovetik (Alternatif yang lebih stabil)
        const response = await axios.post(
          "https://lovetik.com/api/ajax/search",
          new URLSearchParams({ query: messageText }),
        );

        const videoData = response.data;

        if (
          videoData.status === "ok" &&
          videoData.links &&
          videoData.links.length > 0
        ) {
          // Ambil link video yang paling atas (biasanya tanpa watermark)
          const videoUrl = videoData.links[0].a;

          await sock.sendMessage(sender, {
            video: { url: videoUrl },
            caption: "Nih, video tiktoknya! ",
            gifPlayback: false,
          });
        } else {
          throw new Error("Videonya ga ketemu :(");
        }
      } catch (err) {
        console.error("Detail Error:", err.message);
        await sock.sendMessage(sender, {
          text: "aduh, gagal download. kayaknya linknya salah atau API lagi sibuk",
        });
      }
    }

    // fitur 7?
    // coming soon
    // ini harusnya end
  });
}

startBot().catch((err) => console.error("Error saat start:", err));
