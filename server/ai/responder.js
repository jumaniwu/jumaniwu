'use strict';

const { getClient } = require('./claudeClient');
const { getDb } = require('../db');

const MODEL = 'claude-sonnet-4-6';
const MAX_HISTORY = 10;

function buildSystemPrompt(session, knowledgeEntries) {
  const knowledgeSection = knowledgeEntries.length > 0
    ? `\n\nKONTEKS BISNIS:\n${knowledgeEntries.map(k => `## ${k.title}\n${k.content}`).join('\n\n')}`
    : '';

  return `Kamu adalah asisten AI untuk ${session.name}.${knowledgeSection}

INSTRUKSI:
- Jawab dalam bahasa yang sama dengan pelanggan (Indonesia atau Inggris)
- Berikan jawaban yang ramah, singkat, dan membantu
- Jika tidak tahu jawabannya, minta klarifikasi atau arahkan ke agen manusia
- Jangan berasumsi tentang informasi yang tidak ada di konteks bisnis
- Hindari merespons pesan grup kecuali ada konteks khusus`.trim();
}

async function generateReply(sessionId, conversationId, userText) {
  const db = getDb();

  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId);
  if (!session) throw new Error('Session not found');

  const knowledge = db.prepare(
    'SELECT title, content FROM knowledge_base WHERE session_id=? ORDER BY created_at ASC'
  ).all(sessionId);

  const history = db.prepare(
    `SELECT role, content FROM messages
     WHERE conversation_id=?
     ORDER BY timestamp DESC
     LIMIT ${MAX_HISTORY}`
  ).all(conversationId).reverse();

  const messages = history.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  // Ensure last message is the current user message (avoid duplicate)
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userText) {
    messages.push({ role: 'user', content: userText });
  }

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(session, knowledge),
    messages,
  });

  return response.content[0]?.text || 'Maaf, saya tidak dapat memproses permintaan Anda saat ini.';
}

module.exports = { generateReply };
