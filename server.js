const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const waService = require('./services/whatsapp');
const scheduler = require('./services/scheduler');
const db = require('./services/db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast to all connected WebSocket dashboard clients
function broadcastWS(type, data) {
  const payload = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Attach listeners to WhatsApp Service
waService.on('*', (event, data) => {
  broadcastWS(event, data);
});

// WebSocket Connection handler
wss.on('connection', (ws) => {
  console.log('🔌 New dashboard WebSocket client connected');
  // Send initial status on connect
  ws.send(JSON.stringify({
    type: 'initial_state',
    data: {
      status: waService.getStatus(),
      schedules: db.getSchedules(),
      botRules: db.getBotRules(),
      contacts: db.getContacts(),
      logs: db.getLogs(50),
      settings: db.getSettings()
    }
  }));
});

// --- REST API ENDPOINTS ---

// WhatsApp Status & Session
app.get('/api/status', (req, res) => {
  res.json(waService.getStatus());
});

app.post('/api/logout', async (req, res) => {
  const result = await waService.logout();
  res.json(result);
});

app.get('/api/groups', async (req, res) => {
  const groups = await waService.syncGroups();
  res.json(groups);
});

// Schedules
app.get('/api/schedules', (req, res) => {
  res.json(db.getSchedules());
});

app.post('/api/schedules', (req, res) => {
  try {
    const newSchedule = db.addSchedule(req.body);
    scheduler.reloadSchedules();
    broadcastWS('schedules_updated', db.getSchedules());
    res.json({ success: true, schedule: newSchedule });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/schedules/:id', (req, res) => {
  try {
    const updated = db.updateSchedule(req.params.id, req.body);
    scheduler.reloadSchedules();
    broadcastWS('schedules_updated', db.getSchedules());
    res.json({ success: true, schedule: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/schedules/:id', (req, res) => {
  try {
    db.deleteSchedule(req.params.id);
    scheduler.reloadSchedules();
    broadcastWS('schedules_updated', db.getSchedules());
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/schedules/:id/run-now', async (req, res) => {
  try {
    await scheduler.runNow(req.params.id);
    broadcastWS('schedules_updated', db.getSchedules());
    broadcastWS('logs_updated', db.getLogs(50));
    res.json({ success: true, message: 'Pesan berhasil dikirim sekarang!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bot Rules
app.get('/api/bot-rules', (req, res) => {
  res.json(db.getBotRules());
});

app.post('/api/bot-rules', (req, res) => {
  try {
    const newRule = db.addBotRule(req.body);
    broadcastWS('rules_updated', db.getBotRules());
    res.json({ success: true, rule: newRule });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/bot-rules/:id', (req, res) => {
  try {
    const updated = db.updateBotRule(req.params.id, req.body);
    broadcastWS('rules_updated', db.getBotRules());
    res.json({ success: true, rule: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/bot-rules/:id', (req, res) => {
  try {
    db.deleteBotRule(req.params.id);
    broadcastWS('rules_updated', db.getBotRules());
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Contacts
app.get('/api/contacts', (req, res) => {
  res.json(db.getContacts());
});

app.post('/api/contacts', (req, res) => {
  try {
    const contact = db.addContact(req.body);
    broadcastWS('contacts_updated', db.getContacts());
    res.json({ success: true, contact });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    db.deleteContact(req.params.id);
    broadcastWS('contacts_updated', db.getContacts());
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Logs
app.get('/api/logs', (req, res) => {
  res.json(db.getLogs(100));
});

// Broadcast dispatcher
app.post('/api/broadcast', async (req, res) => {
  const { recipients, message } = req.body;
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Daftar penerima tidak boleh kosong' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Pesan broadcast tidak boleh kosong' });
  }

  if (waService.status !== 'connected') {
    return res.status(400).json({ error: 'WhatsApp belum terhubung!' });
  }

  const settings = db.getSettings();
  const delaySec = (settings.broadcastDelaySec || 3) * 1000;

  // Run broadcast process in background and report progress
  res.json({ success: true, message: `Broadcasting ke ${recipients.length} penerima telah dimulai!` });

  (async () => {
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const rec = recipients[i];
      try {
        await waService.sendMessage(rec, message);
        successCount++;
      } catch (err) {
        failCount++;
        db.addLog({
          type: 'BROADCAST_FAIL',
          recipient: rec,
          message,
          error: err.message
        });
      }

      broadcastWS('broadcast_progress', {
        current: i + 1,
        total: recipients.length,
        successCount,
        failCount,
        recipient: rec
      });

      // Delay between messages for anti-ban safety
      if (i < recipients.length - 1) {
        await new Promise(r => setTimeout(r, delaySec));
      }
    }

    db.addLog({
      type: 'BROADCAST_COMPLETE',
      total: recipients.length,
      successCount,
      failCount,
      message
    });

    broadcastWS('logs_updated', db.getLogs(50));
  })();
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = db.updateSettings(req.body);
  scheduler.reloadSchedules();
  broadcastWS('settings_updated', updated);
  res.json({ success: true, settings: updated });
});

// Fallback route to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server & Init WhatsApp & Scheduler
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 WA Bot & Scheduler Server running on http://localhost:${PORT}`);
  console.log(`====================================================`);

  waService.init();
  scheduler.init(waService);
});
