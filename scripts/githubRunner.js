const { default: makeWASocket, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const mongoStore = require('../services/mongoDbStore');

async function runScheduledJobs() {
  console.log('🚀 [GitHub Actions Runner] Starting automated WhatsApp scheduled message check...');

  const connected = await mongoStore.init();
  if (!connected) {
    console.error('❌ MONGODB_URI missing or connection failed. Exiting.');
    process.exit(1);
  }

  const schedules = await mongoStore.getSchedules();
  const activeSchedules = schedules.filter(s => s.active !== false);

  if (activeSchedules.length === 0) {
    console.log('ℹ️ No active scheduled messages found in MongoDB Atlas.');
    process.exit(0);
  }

  const now = new Date();
  const currentHourMin = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  const currentDay = now.getDay(); // 0-6

  console.log(`⏰ Current Server Time: ${now.toISOString()} (${currentHourMin})`);

  // Filter schedules due for sending
  const dueSchedules = activeSchedules.filter(item => {
    if (!item.time) return false;
    
    // Check if time matches (or within 15 mins window for GitHub Cron)
    const [targetHour, targetMin] = item.time.split(':').map(Number);
    const targetMinutes = targetHour * 60 + targetMin;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Matching within 15-minute window
    const isTimeMatch = Math.abs(nowMinutes - targetMinutes) <= 15;

    // Check days if weekly
    if (item.recurrence === 'weekly' && Array.isArray(item.days)) {
      if (!item.days.includes(currentDay)) return false;
    }

    // Prevent double execution on same day
    if (item.lastRun) {
      const lastRunDate = new Date(item.lastRun).toDateString();
      if (lastRunDate === now.toDateString()) {
        return false;
      }
    }

    return isTimeMatch;
  });

  if (dueSchedules.length === 0) {
    console.log('✅ No scheduled messages due at this time.');
    process.exit(0);
  }

  console.log(`📢 Found ${dueSchedules.length} scheduled message(s) due to send!`);

  // Fetch Baileys Auth State from MongoDB
  const sessionData = await mongoStore.getSessionData('baileys_creds');
  if (!sessionData) {
    console.error('❌ WhatsApp Session creds not found in MongoDB Atlas. Have you scanned the QR code yet?');
    await mongoStore.addLog({
      type: 'GITHUB_RUNNER_FAIL',
      error: 'WhatsApp Session not logged in MongoDB Atlas'
    });
    process.exit(1);
  }

  // Restore Baileys Auth State from MongoDB
  const state = {
    creds: sessionData,
    keys: {
      get: async (type, ids) => {
        const data = {};
        for (const id of ids) {
          const keyData = await mongoStore.getSessionData(`${type}-${id}`);
          if (keyData) data[id] = keyData;
        }
        return data;
      },
      set: async (data) => {
        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id];
            const key = `${category}-${id}`;
            if (value) {
              await mongoStore.setSessionData(key, value);
            } else {
              await mongoStore.removeSessionData(key);
            }
          }
        }
      }
    }
  };

  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ['GitHub Actions Runner', 'Chrome', '1.0.0']
  });

  // Wait for WhatsApp connection open
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 25000);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        clearTimeout(timeout);
        resolve();
      } else if (connection === 'close') {
        clearTimeout(timeout);
        reject(lastDisconnect?.error || new Error('Connection closed'));
      }
    });
  });

  console.log('✅ WhatsApp connected via GitHub Actions runner!');

  for (const item of dueSchedules) {
    try {
      console.log(`📤 Sending scheduled message: "${item.title}" to ${item.recipientId}`);
      
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[now.getDay()];
      const dateStr = now.toLocaleDateString('id-ID');
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      let formattedText = item.message
        .replace(/\{tanggal\}/gi, dateStr)
        .replace(/\{jam\}/gi, timeStr)
        .replace(/\{hari\}/gi, dayName)
        .replace(/\{perusahaan\}/gi, 'Perusahaan');

      let targetJid = item.recipientId;
      if (!targetJid.endsWith('@g.us') && !targetJid.endsWith('@s.whatsapp.net')) {
        let clean = targetJid.replace(/\D/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);
        targetJid = `${clean}@s.whatsapp.net`;
      }

      await sock.sendMessage(targetJid, { text: formattedText });

      // Update lastRun in MongoDB
      await mongoStore.updateSchedule(item.id, { lastRun: new Date().toISOString() });

      await mongoStore.addLog({
        type: 'SCHEDULED_SENT_GITHUB',
        title: item.title,
        recipient: item.recipientId,
        message: formattedText,
        status: 'success'
      });

      console.log(`✅ Message "${item.title}" successfully sent!`);
      await delay(3000);
    } catch (err) {
      console.error(`❌ Failed to send schedule "${item.title}":`, err.message);
      await mongoStore.addLog({
        type: 'SCHEDULED_FAIL_GITHUB',
        title: item.title,
        recipient: item.recipientId,
        error: err.message
      });
    }
  }

  console.log('🎉 All scheduled jobs processed cleanly. Disconnecting.');
  await sock.logout().catch(() => {});
  process.exit(0);
}

runScheduledJobs().catch(err => {
  console.error('Fatal error in GitHub runner:', err);
  process.exit(1);
});
