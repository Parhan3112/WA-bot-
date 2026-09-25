const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const chatbot = require('./chatbot');
const db = require('./db');
const mongoStore = require('./mongoDbStore');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.qrCode = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.user = null;
    this.groups = [];
    this.eventListeners = [];
    this.authFolder = path.join(__dirname, '..', 'auth_info_baileys');
  }

  on(event, callback) {
    this.eventListeners.push({ event, callback });
  }

  emit(event, data) {
    this.eventListeners.forEach(listener => {
      if (listener.event === event || listener.event === '*') {
        listener.callback(event, data);
      }
    });
  }

  async init() {
    try {
      this.status = 'connecting';
      this.emit('status_change', { status: this.status });

      await mongoStore.init();

      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['WhatsApp Bot Dashboard', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        syncFullHistory: false
      });

      this.sock.ev.on('creds.update', async () => {
        await saveCreds();
        // Sync creds to MongoDB Atlas if available
        if (mongoStore.isMongo && state.creds) {
          await mongoStore.setSessionData('baileys_creds', state.creds);
        }
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await QRCode.toDataURL(qr);
            this.status = 'qr_ready';
            console.log('📱 New WhatsApp QR Code generated');

            // Save QR Data URL to MongoDB Atlas so Vercel frontend can display it
            if (mongoStore.isMongo) {
              await mongoStore.setSessionData('qr_code_data_url', this.qrCode);
            }

            this.emit('qr', { qr: this.qrCode });
            this.emit('status_change', { status: this.status, qr: this.qrCode });
          } catch (err) {
            console.error('QR code generation error:', err);
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`Connection closed due to ${lastDisconnect?.error}. Reconnecting: ${shouldReconnect}`);
          
          this.status = 'disconnected';
          this.qrCode = null;
          this.user = null;
          this.emit('status_change', { status: this.status });

          if (shouldReconnect) {
            setTimeout(() => this.init(), 3000);
          }
        } else if (connection === 'open') {
          this.status = 'connected';
          this.qrCode = null;
          this.user = this.sock.user;
          console.log(`✅ WhatsApp Connected as: ${this.user?.name || this.user?.id}`);

          // Save active user info & clear QR code from MongoDB Atlas
          if (mongoStore.isMongo) {
            await mongoStore.setSessionData('qr_code_data_url', null);
            await mongoStore.setSessionData('baileys_creds', state.creds);
          }

          // Fetch group lists
          await this.syncGroups();

          this.emit('status_change', {
            status: this.status,
            user: this.user,
            groups: this.groups
          });
        }
      });

      // Handle incoming messages for Auto-responder / Chatbot
      this.sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
          if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;

          const settings = db.getSettings();
          if (settings.autoReplyEnabled !== false) {
            await chatbot.handleMessage(this, msg);
          }

          const text = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text || 
                       msg.message?.imageMessage?.caption || '';

          this.emit('message_received', {
            from: msg.key.remoteJid,
            pushName: msg.pushName || 'Pengirim',
            text: text,
            timestamp: new Date().toISOString()
          });
        }
      });

    } catch (err) {
      console.error('Failed to initialize WhatsApp socket:', err);
      this.status = 'disconnected';
      this.emit('status_change', { status: this.status, error: err.message });
    }
  }

  async syncGroups() {
    try {
      if (!this.sock || this.status !== 'connected') return [];
      const groupsMap = await this.sock.groupFetchAllParticipating();
      this.groups = Object.values(groupsMap).map(g => ({
        id: g.id,
        subject: g.subject,
        participantsCount: g.participants ? g.participants.length : 0
      }));
      console.log(`Synced ${this.groups.length} WhatsApp groups.`);
      return this.groups;
    } catch (err) {
      console.error('Failed to sync groups:', err);
      return [];
    }
  }

  formatJid(raw) {
    if (!raw) return '';
    if (raw.endsWith('@g.us') || raw.endsWith('@s.whatsapp.net')) return raw;
    let clean = raw.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    return `${clean}@s.whatsapp.net`;
  }

  async sendMessage(target, text) {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error('WhatsApp is not connected!');
    }

    const jid = this.formatJid(target);
    const result = await this.sock.sendMessage(jid, { text });
    
    mongoStore.addLog({
      type: 'OUTBOUND',
      recipient: jid,
      message: text,
      status: 'success'
    });

    return result;
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
      this.status = 'disconnected';
      this.qrCode = null;
      this.user = null;
      
      if (fs.existsSync(this.authFolder)) {
        fs.rmSync(this.authFolder, { recursive: true, force: true });
      }

      if (mongoStore.isMongo) {
        await mongoStore.removeSessionData('baileys_creds');
        await mongoStore.removeSessionData('qr_code_data_url');
      }

      this.emit('status_change', { status: this.status });
      setTimeout(() => this.init(), 2000);
      return { success: true };
    } catch (err) {
      console.error('Logout error:', err);
      return { success: false, error: err.message };
    }
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.qrCode,
      user: this.user,
      groups: this.groups
    };
  }
}

module.exports = new WhatsAppService();
