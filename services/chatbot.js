const db = require('./db');

class ChatbotService {
  async handleMessage(waService, msg) {
    try {
      const fromJid = msg.key.remoteJid;
      const isGroup = fromJid.endsWith('@g.us');
      const senderName = msg.pushName || 'Rekan';

      const text = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        ''
      ).trim();

      if (!text) return;

      const rules = db.getBotRules().filter(r => r.active !== false);
      const settings = db.getSettings();

      for (const rule of rules) {
        // Scope filter
        if (rule.targetScope === 'private' && isGroup) continue;
        if (rule.targetScope === 'group' && !isGroup) continue;

        let matched = false;
        const trigger = (rule.trigger || '').trim().toLowerCase();
        const inputMsg = text.toLowerCase();

        switch (rule.matchType) {
          case 'exact':
            matched = inputMsg === trigger;
            break;
          case 'startswith':
            matched = inputMsg.startsWith(trigger);
            break;
          case 'regex':
            try {
              const regex = new RegExp(rule.trigger, 'i');
              matched = regex.test(text);
            } catch (e) {
              matched = false;
            }
            break;
          case 'contains':
          default:
            matched = inputMsg.includes(trigger);
            break;
        }

        if (matched) {
          console.log(`🤖 Bot Rule matched: "${rule.name}" for message: "${text}"`);
          
          // Increment rule match count
          db.incrementRuleCount(rule.id);

          // Render dynamic placeholders
          const now = new Date();
          const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const dayName = dayNames[now.getDay()];
          const dateStr = now.toLocaleDateString('id-ID');
          const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

          let responseText = rule.response
            .replace(/\{nama\}/gi, senderName)
            .replace(/\{nomor\}/gi, fromJid.split('@')[0])
            .replace(/\{tanggal\}/gi, dateStr)
            .replace(/\{jam\}/gi, timeStr)
            .replace(/\{hari\}/gi, dayName)
            .replace(/\{perusahaan\}/gi, settings.companyName || 'Perusahaan');

          // Send auto-reply
          await waService.sendMessage(fromJid, responseText);

          // Log event
          db.addLog({
            type: 'BOT_REPLY',
            ruleName: rule.name,
            recipient: fromJid,
            trigger: text,
            response: responseText,
            status: 'success'
          });

          // Stop checking rules after first match
          break;
        }
      }
    } catch (err) {
      console.error('Error handling chatbot auto-responder:', err);
    }
  }
}

module.exports = new ChatbotService();
