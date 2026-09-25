const fs = require('fs');
const path = require('path');

// Determine writable directory for Vercel / Serverless vs local
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const dataDir = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(dataDir, 'db.json');

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create data directory, using memory fallback:', e.message);
}

const initialData = {
  schedules: [
    {
      id: 'sched-1',
      title: 'Laporan Absensi Pagi & Pengingat Standup',
      recipientType: 'group',
      recipientId: '120363000000000000@g.us',
      recipientName: 'Grup WhatsApp Tim Internal',
      message: 'Selamat pagi Tim! ☀️\n\nJangan lupa untuk mengisi absensi kehadiran dan mengupdate tugas harian di sistem sebelum jam 09:00 WIB.\n\nMeeting Standup Pagi akan dimulai jam 09:15 WIB di Google Meet.\nSemangat bekerja hari ini! 💪',
      recurrence: 'daily',
      time: '08:00',
      days: [1, 2, 3, 4, 5],
      cronExpression: '0 8 * * 1-5',
      active: true,
      lastRun: null,
      createdAt: new Date().toISOString()
    }
  ],
  botRules: [
    {
      id: 'rule-1',
      name: 'Menu Utama Bot Internal',
      trigger: 'help',
      matchType: 'contains',
      targetScope: 'all',
      response: '🤖 *SELAMAT DATANG DI BOT INTERNAL PERUSAHAAN*\n\nSilakan pilih menu bantuan di bawah ini dengan mengetik kata kunci:\n\n1️⃣ *!absensi* - Informasi & Link Absensi Kehadiran\n2️⃣ *!it* - Bantuan IT Support / Kendala Teknis\n3️⃣ *!lapor* - Format Laporan Harian Tim\n\n_Sistem Otomatis Internal Company_',
      active: true,
      matchCount: 0,
      createdAt: new Date().toISOString()
    }
  ],
  contacts: [],
  broadcastLogs: [],
  settings: {
    companyName: 'PT Sampel Nusantara',
    broadcastDelaySec: 3,
    autoReplyEnabled: true,
    scheduledMsgEnabled: true
  }
};

class DBManager {
  constructor() {
    this.data = initialData;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (err) {
      this.data = initialData;
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      // Ignore write error on read-only serverless filesystem
    }
  }

  getSchedules() { return this.data.schedules || []; }
  addSchedule(schedule) {
    schedule.id = 'sched-' + Date.now();
    schedule.createdAt = new Date().toISOString();
    schedule.active = schedule.active !== undefined ? schedule.active : true;
    if (!this.data.schedules) this.data.schedules = [];
    this.data.schedules.push(schedule);
    this.save();
    return schedule;
  }
  updateSchedule(id, updatedFields) {
    if (!this.data.schedules) return null;
    const idx = this.data.schedules.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.data.schedules[idx] = { ...this.data.schedules[idx], ...updatedFields };
      this.save();
      return this.data.schedules[idx];
    }
    return null;
  }
  deleteSchedule(id) {
    if (!this.data.schedules) return;
    this.data.schedules = this.data.schedules.filter(s => s.id !== id);
    this.save();
  }

  getBotRules() { return this.data.botRules || []; }
  addBotRule(rule) {
    rule.id = 'rule-' + Date.now();
    rule.createdAt = new Date().toISOString();
    rule.active = rule.active !== undefined ? rule.active : true;
    rule.matchCount = 0;
    if (!this.data.botRules) this.data.botRules = [];
    this.data.botRules.push(rule);
    this.save();
    return rule;
  }
  updateBotRule(id, updatedFields) {
    if (!this.data.botRules) return null;
    const idx = this.data.botRules.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.data.botRules[idx] = { ...this.data.botRules[idx], ...updatedFields };
      this.save();
      return this.data.botRules[idx];
    }
    return null;
  }
  deleteBotRule(id) {
    if (!this.data.botRules) return;
    this.data.botRules = this.data.botRules.filter(r => r.id !== id);
    this.save();
  }

  getContacts() { return this.data.contacts || []; }
  addContact(contact) {
    contact.id = 'c-' + Date.now();
    if (!this.data.contacts) this.data.contacts = [];
    this.data.contacts.push(contact);
    this.save();
    return contact;
  }
  deleteContact(id) {
    if (!this.data.contacts) return;
    this.data.contacts = this.data.contacts.filter(c => c.id !== id);
    this.save();
  }

  getLogs(limit = 100) {
    return (this.data.broadcastLogs || []).slice(-limit).reverse();
  }
  addLog(log) {
    if (!this.data.broadcastLogs) this.data.broadcastLogs = [];
    const entry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...log
    };
    this.data.broadcastLogs.push(entry);
    this.save();
    return entry;
  }

  getSettings() { return this.data.settings || initialData.settings; }
  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }
}

module.exports = new DBManager();
