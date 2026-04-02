'use strict';

require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  DASHBOARD_API_KEY: process.env.DASHBOARD_API_KEY || '',
  SESSIONS_DIR: require('path').join(__dirname, '..', 'sessions'),
};
