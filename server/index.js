'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { PORT } = require('./config');
const { getDb } = require('./db');
const sessionManager = require('./whatsapp/sessionManager');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Make io accessible to routes
app.set('io', io);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/broadcast', require('./routes/broadcast'));

// Fallback: serve dashboard for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Expose io to sessionManager for real-time events
sessionManager.setIo(io);

// On startup, reconnect sessions that were previously connected
async function restoreSessions() {
  const db = getDb();
  const activeSessions = db.prepare(
    "SELECT id FROM sessions WHERE status IN ('connected', 'connecting')"
  ).all();

  for (const session of activeSessions) {
    console.log(`Restoring session ${session.id}...`);
    db.prepare("UPDATE sessions SET status='disconnected' WHERE id=?").run(session.id);
  }
}

httpServer.listen(PORT, async () => {
  console.log(`\n🚀 Jumaniwu WhatsApp AI Agent running at http://localhost:${PORT}\n`);
  await restoreSessions();
});
