'use strict';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const { SESSIONS_DIR } = require('../config');
const sessionManager = require('./sessionManager');
const messageHandler = require('./messageHandler');
const { getDb } = require('../db');

// Suppress Baileys verbose logging
const P = require('pino');
const logger = P({ level: 'silent' });

async function createSession(sessionId) {
  // If already running, destroy first
  if (sessionManager.has(sessionId)) {
    await destroySession(sessionId);
  }

  const sessionDir = path.join(SESSIONS_DIR, sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['Jumaniwu AI', 'Chrome', '3.0'],
  });

  const io = sessionManager.getIo();
  const db = getDb();

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Generate QR as data URL for frontend
      const qrDataUrl = await qrcode.toDataURL(qr);
      db.prepare("UPDATE sessions SET status='qr', updated_at=unixepoch() WHERE id=?").run(sessionId);
      io?.emit('qr', { sessionId, qrDataUrl });
    }

    if (connection === 'open') {
      const phone = sock.user?.id ? jidNormalizedUser(sock.user.id).split('@')[0] : null;
      db.prepare("UPDATE sessions SET status='connected', phone=?, updated_at=unixepoch() WHERE id=?")
        .run(phone, sessionId);
      io?.emit('session:connected', { sessionId, phone });
      console.log(`[${sessionId}] Connected as ${phone}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      db.prepare("UPDATE sessions SET status='disconnected', updated_at=unixepoch() WHERE id=?").run(sessionId);
      io?.emit('session:disconnected', { sessionId });
      sessionManager.remove(sessionId);
      console.log(`[${sessionId}] Disconnected (code=${statusCode}, reconnect=${shouldReconnect})`);

      if (shouldReconnect) {
        // Auto-reconnect after 3s
        setTimeout(() => createSession(sessionId), 3000);
      } else {
        // Logged out: delete auth files
        fs.rmSync(sessionDir, { recursive: true, force: true });
        db.prepare("UPDATE sessions SET status='disconnected', phone=NULL, updated_at=unixepoch() WHERE id=?").run(sessionId);
      }
    }
  });

  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      try {
        await messageHandler.handle(sessionId, sock, msg);
      } catch (err) {
        console.error(`[${sessionId}] Error handling message:`, err);
      }
    }
  });

  sessionManager.set(sessionId, { sock });
  db.prepare("UPDATE sessions SET status='connecting', updated_at=unixepoch() WHERE id=?").run(sessionId);

  return sock;
}

async function destroySession(sessionId) {
  const instance = sessionManager.get(sessionId);
  if (instance) {
    try {
      await instance.sock.logout();
    } catch (_) {}
    try {
      instance.sock.end();
    } catch (_) {}
    sessionManager.remove(sessionId);
  }
  const db = getDb();
  db.prepare("UPDATE sessions SET status='disconnected', updated_at=unixepoch() WHERE id=?").run(sessionId);
  sessionManager.getIo()?.emit('session:disconnected', { sessionId });
}

module.exports = { createSession, destroySession };
