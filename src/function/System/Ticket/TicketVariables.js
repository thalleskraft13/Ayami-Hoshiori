'use strict';

const VARIABLE_PATTERN = /\{user\.id\}|\{user\}|\{count\}/g;

const AVAILABLE_VARIABLES = [
  { key: '{user}',    description: 'Username do usuário que criou o ticket' },
  { key: '{user.id}', description: 'ID do usuário que criou o ticket' },
  { key: '{count}',   description: 'Sequência/quantidade do ticket criado' },
];

function sanitizeForChannelName(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolve(template, { username, userId, count } = {}) {
  if (!template) return '';

  return String(template).replace(VARIABLE_PATTERN, (match) => {
    switch (match) {
      case '{user}':
        return username != null ? sanitizeForChannelName(username) : '';
      case '{user.id}':
        return userId != null ? String(userId) : '';
      case '{count}':
        return count != null ? String(count) : '';
      default:
        return match;
    }
  });
}

function buildChannelName(template, ctx = {}) {
  const resolved = resolve(template, ctx);
  const fallback = sanitizeForChannelName(resolved) || 'ticket';
  return fallback.slice(0, 90);
}

function hasVariable(template, key) {
  if (!template) return false;
  return template.includes(key);
}

module.exports = {
  AVAILABLE_VARIABLES,
  resolve,
  buildChannelName,
  hasVariable,
  sanitizeForChannelName,
};
