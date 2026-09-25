const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoStore = require('../services/mongoDbStore');
const dbLocal = require('../services/db');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Auto init mongo connection if URI present
app.use(async (req, res, next) => {
  try {
    if (!mongoStore.client && process.env.MONGODB_URI) {
      await mongoStore.init();
    }
  } catch (e) {
    console.error('Mongo init warning:', e.message);
  }
  next();
});

// REST API Endpoints
app.get('/api/status', async (req, res) => {
  try {
    const isMongo = mongoStore.isMongo;
    let user = null;
    let qr = null;

    if (isMongo) {
      const creds = await mongoStore.getSessionData('baileys_creds');
      user = creds?.me || null;
      qr = await mongoStore.getSessionData('qr_code_data_url');
    }

    res.json({
      status: user ? 'connected' : (qr ? 'qr_ready' : 'disconnected'),
      qr: qr || null,
      user: user || null,
      isCloudDB: isMongo
    });
  } catch (err) {
    res.json({ status: 'disconnected', isCloudDB: false, error: err.message });
  }
});

app.get('/api/schedules', async (req, res) => {
  try {
    const data = await mongoStore.getSchedules();
    res.json(data);
  } catch (e) {
    res.json(dbLocal.getSchedules());
  }
});

app.post('/api/schedules', async (req, res) => {
  try {
    const newSchedule = await mongoStore.addSchedule(req.body);
    res.json({ success: true, schedule: newSchedule });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/schedules/:id', async (req, res) => {
  try {
    const updated = await mongoStore.updateSchedule(req.params.id, req.body);
    res.json({ success: true, schedule: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/schedules/:id', async (req, res) => {
  try {
    await mongoStore.deleteSchedule(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/bot-rules', async (req, res) => {
  try {
    const data = await mongoStore.getBotRules();
    res.json(data);
  } catch (e) {
    res.json(dbLocal.getBotRules());
  }
});

app.post('/api/bot-rules', async (req, res) => {
  try {
    const rule = await mongoStore.addBotRule(req.body);
    res.json({ success: true, rule });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/bot-rules/:id', async (req, res) => {
  try {
    const updated = await mongoStore.updateBotRule(req.params.id, req.body);
    res.json({ success: true, rule: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/bot-rules/:id', async (req, res) => {
  try {
    await mongoStore.deleteBotRule(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/contacts', async (req, res) => {
  try {
    const data = await mongoStore.getContacts();
    res.json(data);
  } catch (e) {
    res.json(dbLocal.getContacts());
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const contact = await mongoStore.addContact(req.body);
    res.json({ success: true, contact });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/contacts/:id', async (req, res) => {
  try {
    await mongoStore.deleteContact(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await mongoStore.getLogs(100);
    res.json(logs);
  } catch (e) {
    res.json(dbLocal.getLogs(100));
  }
});

app.get('/api/groups', (req, res) => {
  res.json([]);
});

app.get('/api/settings', (req, res) => {
  res.json(dbLocal.getSettings());
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
