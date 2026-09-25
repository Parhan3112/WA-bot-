const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const dbLocal = require('./db');

class MongoDbStore {
  constructor() {
    this.client = null;
    this.db = null;
    this.isMongo = false;
  }

  async init() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.log('ℹ️ MONGODB_URI not found. Using local JSON database storage.');
      return false;
    }

    try {
      this.client = new MongoClient(mongoUri);
      await this.client.connect();
      this.db = this.client.db('wabots');
      this.isMongo = true;
      console.log('🍃 Successfully connected to MongoDB Atlas Cloud Database!');
      return true;
    } catch (err) {
      console.error('❌ Failed to connect to MongoDB Atlas, falling back to local storage:', err.message);
      this.isMongo = false;
      return false;
    }
  }

  // Schedules
  async getSchedules() {
    if (!this.isMongo) return dbLocal.getSchedules();
    const col = this.db.collection('schedules');
    return await col.find({}).toArray();
  }

  async addSchedule(schedule) {
    if (!this.isMongo) return dbLocal.addSchedule(schedule);
    const col = this.db.collection('schedules');
    schedule.id = 'sched-' + Date.now();
    schedule.createdAt = new Date().toISOString();
    schedule.active = schedule.active !== undefined ? schedule.active : true;
    await col.insertOne(schedule);
    return schedule;
  }

  async updateSchedule(id, fields) {
    if (!this.isMongo) return dbLocal.updateSchedule(id, fields);
    const col = this.db.collection('schedules');
    await col.updateOne({ id }, { $set: fields });
    return await col.findOne({ id });
  }

  async deleteSchedule(id) {
    if (!this.isMongo) return dbLocal.deleteSchedule(id);
    const col = this.db.collection('schedules');
    await col.deleteOne({ id });
  }

  // Bot Rules
  async getBotRules() {
    if (!this.isMongo) return dbLocal.getBotRules();
    const col = this.db.collection('botRules');
    return await col.find({}).toArray();
  }

  async addBotRule(rule) {
    if (!this.isMongo) return dbLocal.addBotRule(rule);
    const col = this.db.collection('botRules');
    rule.id = 'rule-' + Date.now();
    rule.createdAt = new Date().toISOString();
    rule.active = rule.active !== undefined ? rule.active : true;
    rule.matchCount = 0;
    await col.insertOne(rule);
    return rule;
  }

  async updateBotRule(id, fields) {
    if (!this.isMongo) return dbLocal.updateBotRule(id, fields);
    const col = this.db.collection('botRules');
    await col.updateOne({ id }, { $set: fields });
    return await col.findOne({ id });
  }

  async deleteBotRule(id) {
    if (!this.isMongo) return dbLocal.deleteBotRule(id);
    const col = this.db.collection('botRules');
    await col.deleteOne({ id });
  }

  // Contacts
  async getContacts() {
    if (!this.isMongo) return dbLocal.getContacts();
    const col = this.db.collection('contacts');
    return await col.find({}).toArray();
  }

  async addContact(contact) {
    if (!this.isMongo) return dbLocal.addContact(contact);
    const col = this.db.collection('contacts');
    contact.id = 'c-' + Date.now();
    await col.insertOne(contact);
    return contact;
  }

  async deleteContact(id) {
    if (!this.isMongo) return dbLocal.deleteContact(id);
    const col = this.db.collection('contacts');
    await col.deleteOne({ id });
  }

  // Logs
  async getLogs(limit = 100) {
    if (!this.isMongo) return dbLocal.getLogs(limit);
    const col = this.db.collection('logs');
    return await col.find({}).sort({ timestamp: -1 }).limit(limit).toArray();
  }

  async addLog(log) {
    if (!this.isMongo) return dbLocal.addLog(log);
    const col = this.db.collection('logs');
    const entry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...log
    };
    await col.insertOne(entry);
    return entry;
  }

  // Baileys Session in MongoDB Atlas
  async getSessionData(key) {
    if (!this.isMongo) return null;
    const col = this.db.collection('sessions');
    const res = await col.findOne({ key });
    return res ? res.data : null;
  }

  async setSessionData(key, data) {
    if (!this.isMongo) return;
    const col = this.db.collection('sessions');
    await col.updateOne({ key }, { $set: { key, data, updatedAt: new Date() } }, { upsert: true });
  }

  async removeSessionData(key) {
    if (!this.isMongo) return;
    const col = this.db.collection('sessions');
    await col.deleteOne({ key });
  }
}

module.exports = new MongoDbStore();
