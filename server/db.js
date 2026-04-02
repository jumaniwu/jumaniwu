'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'jumaniwu.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  migrate(_db);
  return _db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT,
      status     TEXT DEFAULT 'disconnected',
      ai_enabled INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      jid        TEXT NOT NULL,
      name       TEXT,
      phone      TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(session_id, jid)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id              TEXT PRIMARY KEY,
      session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      contact_jid     TEXT NOT NULL,
      contact_name    TEXT,
      ai_enabled      INTEGER DEFAULT 1,
      unread_count    INTEGER DEFAULT 0,
      last_message    TEXT,
      last_message_at INTEGER,
      created_at      INTEGER DEFAULT (unixepoch()),
      updated_at      INTEGER DEFAULT (unixepoch()),
      UNIQUE(session_id, contact_jid)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      whatsapp_id     TEXT,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      timestamp       INTEGER NOT NULL,
      is_read         INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id, last_message_at);

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);
}

module.exports = { getDb };
