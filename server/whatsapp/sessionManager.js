'use strict';

// Map<sessionId, { sock, ev }>
const activeSessions = new Map();
let _io = null;

function setIo(io) {
  _io = io;
}

function getIo() {
  return _io;
}

function set(sessionId, instance) {
  activeSessions.set(sessionId, instance);
}

function get(sessionId) {
  return activeSessions.get(sessionId);
}

function remove(sessionId) {
  activeSessions.delete(sessionId);
}

function has(sessionId) {
  return activeSessions.has(sessionId);
}

function all() {
  return activeSessions;
}

module.exports = { setIo, getIo, set, get, remove, has, all };
