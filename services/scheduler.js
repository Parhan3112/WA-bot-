const cron = require('node-cron');
const db = require('./db');

class SchedulerService {
  constructor() {
    this.cronTasks = new Map();
    this.waService = null;
  }

  init(waService) {
    this.waService = waService;
    this.reloadSchedules();
    console.log('⏰ Scheduled Message Engine initialized.');
  }

  reloadSchedules() {
    // Stop all current tasks
    for (const [id, task] of this.cronTasks.entries()) {
      task.stop();
    }
    this.cronTasks.clear();

    const settings = db.getSettings();
    if (settings.scheduledMsgEnabled === false) {
      console.log('Scheduled messages disabled in settings.');
      return;
    }

    const schedules = db.getSchedules().filter(s => s.active !== false);

    for (const item of schedules) {
      this.registerSchedule(item);
    }

    console.log(`⏰ Loaded ${this.cronTasks.size} active message schedules.`);
  }

  registerSchedule(item) {
    let cronExpr = item.cronExpression;

    if (!cronExpr && item.time) {
      const [hour, minute] = item.time.split(':');
      if (item.recurrence === 'daily') {
        cronExpr = `${parseInt(minute)} ${parseInt(hour)} * * *`;
      } else if (item.recurrence === 'weekly' && Array.isArray(item.days)) {
        const daysStr = item.days.join(',');
        cronExpr = `${parseInt(minute)} ${parseInt(hour)} * * ${daysStr}`;
      } else if (item.recurrence === 'interval' && item.intervalMinutes) {
        cronExpr = `*/${item.intervalMinutes} * * * *`;
      }
    }

    if (!cronExpr || !cron.validate(cronExpr)) {
      console.error(`Invalid cron expression for schedule ${item.id}:`, cronExpr);
      return;
    }

    try {
      const task = cron.schedule(cronExpr, async () => {
        console.log(`⏰ Triggering scheduled message: "${item.title}"`);
        await this.executeSchedule(item);
      });

      this.cronTasks.set(item.id, task);
    } catch (err) {
      console.error(`Failed to register schedule ${item.id}:`, err);
    }
  }

  async executeSchedule(item) {
    if (!this.waService || this.waService.status !== 'connected') {
      console.warn(`Cannot send schedule "${item.title}": WhatsApp is not connected.`);
      db.addLog({
        type: 'SCHEDULED_FAIL',
        title: item.title,
        recipient: item.recipientId,
        message: item.message,
        error: 'WhatsApp disconnected'
      });
      return;
    }

    try {
      const settings = db.getSettings();
      const now = new Date();
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNames[now.getDay()];
      const dateStr = now.toLocaleDateString('id-ID');
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      // Dynamic placeholder replacement
      let formattedText = item.message
        .replace(/\{tanggal\}/gi, dateStr)
        .replace(/\{jam\}/gi, timeStr)
        .replace(/\{hari\}/gi, dayName)
        .replace(/\{perusahaan\}/gi, settings.companyName || 'Perusahaan');

      await this.waService.sendMessage(item.recipientId, formattedText);

      // Update lastRun in database
      db.updateSchedule(item.id, { lastRun: new Date().toISOString() });

      db.addLog({
        type: 'SCHEDULED_SENT',
        title: item.title,
        recipient: item.recipientId,
        message: formattedText,
        status: 'success'
      });

      console.log(`✅ Schedule "${item.title}" sent successfully to ${item.recipientId}`);
    } catch (err) {
      console.error(`Error sending scheduled message "${item.title}":`, err);
      db.addLog({
        type: 'SCHEDULED_FAIL',
        title: item.title,
        recipient: item.recipientId,
        message: item.message,
        error: err.message
      });
    }
  }

  async runNow(scheduleId) {
    const item = db.getSchedules().find(s => s.id === scheduleId);
    if (!item) throw new Error('Schedule not found');
    await this.executeSchedule(item);
  }
}

module.exports = new SchedulerService();
