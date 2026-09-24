const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

// Ensure data folder exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initial structure
const initialData = {
  schedules: [
    {
      id: 'sched-1',
      title: 'Laporan Absensi Pagi & Pengingat Standup',
      recipientType: 'group',
      recipientId: '120363000000000000@g.us', // Example group ID
      recipientName: 'Grup WhatsApp Tim Internal',
      message: 'Selamat pagi Tim! ☀️\n\nJangan lupa untuk mengisi absensi kehadiran dan mengupdate tugas harian di sistem sebelum jam 09:00 WIB.\n\nMeeting Standup Pagi akan dimulai jam 09:15 WIB di Google Meet.\nSemangat bekerja hari ini! 💪',
      recurrence: 'daily',
      time: '08:00',
      days: [1, 2, 3, 4, 5], // Mon-Fri
      cronExpression: '0 8 * * 1-5',
      active: true,
      lastRun: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'sched-2',
      title: 'Pengingat Submit Laporan Harian (Daily Report)',
      recipientType: 'group',
      recipientId: '120363000000000000@g.us',
      recipientName: 'Grup WhatsApp Tim Internal',
      message: 'Halo Tim! 📢\n\nPengingat untuk mengirimkan Laporan Hasil Kerja (Daily Log) hari ini sebelum meninggalkan pekerjaan.\n\nKetik "!lapor" untuk panduan format pengiriman laporan.',
      recurrence: 'daily',
      time: '17:00',
      days: [1, 2, 3, 4, 5],
      cronExpression: '0 17 * * 1-5',
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
      response: '🤖 *SELAMAT DATANG DI BOT INTERNAL PERUSAHAAN*\n\nSilakan pilih menu bantuan di bawah ini dengan mengetik kata kunci:\n\n1️⃣ *!absensi* - Informasi & Link Absensi Kehadiran\n2️⃣ *!it* - Bantuan IT Support / Kendala Teknis\n3️⃣ *!lapor* - Format Laporan Harian Tim\n4️⃣ *!kontak* - Direktori Kontak Perusahaan\n\n_Sistem Otomatis Internal Company_',
      active: true,
      matchCount: 0,
      createdAt: new Date().toISOString()
    },
    {
      id: 'rule-2',
      name: 'Informasi Link Absensi',
      trigger: '!absensi',
      matchType: 'contains',
      targetScope: 'all',
      response: '📲 *INFORMASI ABSENSI KARYAWAN*\n\n• Link Portal Absensi: https://hr.perusahaan.com/absensi\n• Jam Kelonggaran: Max 08:30 WIB\n• Izin/Sakit: Hubungi HRD via WhatsApp (+628123456789)\n\nJika ada masalah akun, ketik *!it*.',
      active: true,
      matchCount: 0,
      createdAt: new Date().toISOString()
    },
    {
      id: 'rule-3',
      name: 'Panduan Helpdesk IT',
      trigger: '!it',
      matchType: 'contains',
      targetScope: 'all',
      response: '💻 *HELPDESK & IT SUPPORT PERUSAHAAN*\n\nAda kendala dengan Komputer, Email, atau Network?\n• Buka Ticket Support: https://helpdesk.perusahaan.com\n• Kontak Tim IT: ext 104 / admin-it@perusahaan.com\n• Jam Operasional IT: 08:00 - 17:00 WIB',
      active: true,
      matchCount: 0,
      createdAt: new Date().toISOString()
    },
    {
      id: 'rule-4',
      name: 'Format Submit Laporan Harian',
      trigger: '!lapor',
      matchType: 'contains',
      targetScope: 'all',
      response: '📝 *FORMAT LAPORAN HARIAN (DAILY REPORT)*\n\nFormat Pengiriman:\nNama: [Nama Anda]\nDivisi: [Nama Divisi]\nTugas Selesai:\n1. ...\n2. ...\nKendala/Notes:\n- ...',
      active: true,
      matchCount: 0,
      createdAt: new Date().toISOString()
    }
  ],
  contacts: [
    { id: 'c-1', name: 'Budi Santoso', phone: '6281234567890', tags: ['Management', 'HR'], notes: 'HR Manager' },
    { id: 'c-2', name: 'Siti Rahma', phone: '6289876543210', tags: ['IT', 'Dev'], notes: 'Lead Developer' }
  ],
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
        // Ensure keys exist
        if (!this.data.schedules) this.data.schedules = initialData.schedules;
        if (!this.data.botRules) this.data.botRules = initialData.botRules;
        if (!this.data.contacts) this.data.contacts = initialData.contacts;
        if (!this.data.broadcastLogs) this.data.broadcastLogs = initialData.broadcastLogs;
        if (!this.data.settings) this.data.settings = initialData.settings;
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading DB, using fallback:', err);
      this.data = initialData;
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving DB:', err);
    }
  }

  // Schedule CRUD
  getSchedules() {
    return this.data.schedules;
  }

  addSchedule(schedule) {
    schedule.id = 'sched-' + Date.now();
    schedule.createdAt = new Date().toISOString();
    schedule.active = schedule.active !== undefined ? schedule.active : true;
    this.data.schedules.push(schedule);
    this.save();
    return schedule;
  }

  updateSchedule(id, updatedFields) {
    const idx = this.data.schedules.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.data.schedules[idx] = { ...this.data.schedules[idx], ...updatedFields };
      this.save();
      return this.data.schedules[idx];
    }
    return null;
  }

  deleteSchedule(id) {
    this.data.schedules = this.data.schedules.filter(s => s.id !== id);
    this.save();
  }

  // Bot Rules CRUD
  getBotRules() {
    return this.data.botRules;
  }

  addBotRule(rule) {
    rule.id = 'rule-' + Date.now();
    rule.createdAt = new Date().toISOString();
    rule.active = rule.active !== undefined ? rule.active : true;
    rule.matchCount = 0;
    this.data.botRules.push(rule);
    this.save();
    return rule;
  }

  updateBotRule(id, updatedFields) {
    const idx = this.data.botRules.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.data.botRules[idx] = { ...this.data.botRules[idx], ...updatedFields };
      this.save();
      return this.data.botRules[idx];
    }
    return null;
  }

  deleteBotRule(id) {
    this.data.botRules = this.data.botRules.filter(r => r.id !== id);
    this.save();
  }

  incrementRuleCount(id) {
    const rule = this.data.botRules.find(r => r.id === id);
    if (rule) {
      rule.matchCount = (rule.matchCount || 0) + 1;
      this.save();
    }
  }

  // Contacts CRUD
  getContacts() {
    return this.data.contacts;
  }

  addContact(contact) {
    contact.id = 'c-' + Date.now();
    this.data.contacts.push(contact);
    this.save();
    return contact;
  }

  deleteContact(id) {
    this.data.contacts = this.data.contacts.filter(c => c.id !== id);
    this.save();
  }

  // Logs
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
    // Keep max 500 logs
    if (this.data.broadcastLogs.length > 500) {
      this.data.broadcastLogs = this.data.broadcastLogs.slice(-500);
    }
    this.save();
    return entry;
  }

  // Settings
  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }
}

module.exports = new DBManager();
