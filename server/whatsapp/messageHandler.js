'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { generateReply } = require('../ai/responder');
const sessionManager = require('./sessionManager');

function extractText(msg) {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    null
  );
}

function jidToPhone(jid) {
  return jid.replace(/[@:].*$/, '');
}

async function handle(sessionId, sock, msg) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId);
  if (!session) return;

  const jid = msg.key.remoteJid;
  if (!jid) return;

  // Ignore group messages for now
  if (jid.endsWith('@g.us')) return;

  const text = extractText(msg);
  if (!text) return;

  const phone = jidToPhone(jid);
  const pushName = msg.pushName || phone;
  const ts = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000);

  // Upsert contact
  db.prepare(`
    INSERT INTO contacts (session_id, jid, name, phone)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, jid) DO UPDATE SET
      name = excluded.name,
      phone = excluded.phone
  `).run(sessionId, jid, pushName, phone);

  // Upsert conversation
  let conversation = db.prepare(
    'SELECT * FROM conversations WHERE session_id=? AND contact_jid=?'
  ).get(sessionId, jid);

  if (!conversation) {
    const convId = uuidv4();
    db.prepare(`
      INSERT INTO conversations (id, session_id, contact_jid, contact_name, last_message, last_message_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(convId, sessionId, jid, pushName, text, ts);
    conversation = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  } else {
    db.prepare(`
      UPDATE conversations
      SET contact_name=?, last_message=?, last_message_at=?, unread_count=unread_count+1, updated_at=unixepoch()
      WHERE id=?
    `).run(pushName, text, ts, conversation.id);
  }

  // Save incoming message
  const msgId = uuidv4();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, whatsapp_id, role, content, timestamp)
    VALUES (?, ?, ?, 'user', ?, ?)
  `).run(msgId, conversation.id, msg.key.id, text, ts);

  const io = sessionManager.getIo();
  io?.emit('message:new', {
    conversationId: conversation.id,
    message: { id: msgId, role: 'user', content: text, timestamp: ts },
  });
  io?.emit('conversation:updated', {
    conversation: db.prepare('SELECT * FROM conversations WHERE id=?').get(conversation.id),
  });

  // AI reply (if enabled)
  const freshConv = db.prepare('SELECT * FROM conversations WHERE id=?').get(conversation.id);
  if (!session.ai_enabled || !freshConv.ai_enabled) return;

  // Typing indicator
  await sock.sendPresenceUpdate('composing', jid);

  let replyText;
  try {
    replyText = await generateReply(sessionId, conversation.id, text);
  } catch (err) {
    console.error(`[${sessionId}] AI error:`, err.message);
    await sock.sendPresenceUpdate('paused', jid);
    return;
  }

  await sock.sendPresenceUpdate('paused', jid);
  await sock.sendMessage(jid, { text: replyText });

  const replyTs = Math.floor(Date.now() / 1000);
  const replyId = uuidv4();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, timestamp, is_read)
    VALUES (?, ?, 'assistant', ?, ?, 1)
  `).run(replyId, conversation.id, replyText, replyTs);

  db.prepare(`
    UPDATE conversations SET last_message=?, last_message_at=?, updated_at=unixepoch() WHERE id=?
  `).run(replyText, replyTs, conversation.id);

  io?.emit('message:new', {
    conversationId: conversation.id,
    message: { id: replyId, role: 'assistant', content: replyText, timestamp: replyTs },
  });
  io?.emit('conversation:updated', {
    conversation: db.prepare('SELECT * FROM conversations WHERE id=?').get(conversation.id),
  });
}

module.exports = { handle };
