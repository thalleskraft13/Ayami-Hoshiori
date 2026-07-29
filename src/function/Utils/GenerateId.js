'use strict';

const crypto = require('crypto');

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(timeMs, len) {
  let str = '';
  let now = timeMs;
  for (let i = len; i > 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = (now - mod) / 32;
  }
  return str;
}

function encodeRandom(len) {
  const bytes = crypto.randomBytes(len);
  let str = '';
  for (let i = 0; i < len; i++) {
    str += ENCODING[bytes[i] % 32];
  }
  return str;
}

function ulid(timeMs = Date.now()) {
  return encodeTime(timeMs, 10) + encodeRandom(16);
}

function generateLogicScriptId() {
  return `logic_${ulid()}`;
}

function generateEndpointRequestId() {
  return `epreq_${ulid()}`;
}

module.exports = { ulid, generateLogicScriptId, generateEndpointRequestId };
