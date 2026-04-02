'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY } = require('../config');

let _client = null;

function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return _client;
}

module.exports = { getClient };
