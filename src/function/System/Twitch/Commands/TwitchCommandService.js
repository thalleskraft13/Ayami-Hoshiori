'use strict';

const TwitchCommandDb = require('../../../../Mongodb/twitchCommand.js');
const { PERMISSIONS } = TwitchCommandDb;

const PLATFORM = 'twitch';

const PERMISSION_RANK = {
  [PERMISSIONS.EVERYONE]:    0,
  [PERMISSIONS.SUBSCRIBER]:  1,
  [PERMISSIONS.VIP]:         1,
  [PERMISSIONS.MODERATOR]:   2,
  [PERMISSIONS.BROADCASTER]: 3,
};

class CommandNotFoundError extends Error {
  constructor() {
    super('Comando não encontrado neste servidor.');
    this.code = 'COMMAND_NOT_FOUND';
  }
}

class DuplicateTriggerError extends Error {
  constructor(trigger) {
    super(`Já existe um comando "!${trigger}" configurado neste servidor.`);
    this.code = 'DUPLICATE_TRIGGER';
  }
}

function normalizeTrigger(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^!+/, '');
}

async function listCommands(guildId, platform = PLATFORM) {
  return TwitchCommandDb.find({ guildId, platform }).sort({ createdAt: -1 }).lean();
}

async function getCommand(commandId) {
  return TwitchCommandDb.findById(commandId).lean();
}

async function createCommand({
  guildId,
  platform = PLATFORM,
  trigger,
  response,
  cooldownSeconds = 10,
  permission = PERMISSIONS.EVERYONE,
  createdBy = null,
}) {
  const cleanTrigger = normalizeTrigger(trigger);
  if (!cleanTrigger) throw new Error('Informe um gatilho para o comando (ex.: discord).');
  if (!String(response || '').trim()) throw new Error('Informe a resposta do comando.');

  const exists = await TwitchCommandDb.findOne({ guildId, platform, trigger: cleanTrigger }).lean();
  if (exists) throw new DuplicateTriggerError(cleanTrigger);

  return TwitchCommandDb.create({
    guildId,
    platform,
    trigger: cleanTrigger,
    response: String(response).trim(),
    cooldownSeconds: Math.max(0, Number(cooldownSeconds) || 0),
    permission: Object.values(PERMISSIONS).includes(permission) ? permission : PERMISSIONS.EVERYONE,
    createdBy,
  });
}

async function _requireOwnCommand(commandId, guildId) {
  const command = await TwitchCommandDb.findById(commandId).lean();
  if (!command || command.guildId !== guildId) throw new CommandNotFoundError();
  return command;
}

async function updateCommand(commandId, guildId, patch = {}) {
  await _requireOwnCommand(commandId, guildId);

  const $set = {};

  if (patch.response !== undefined) {
    const response = String(patch.response || '').trim();
    if (!response) throw new Error('A resposta do comando não pode ficar vazia.');
    $set.response = response;
  }

  if (patch.cooldownSeconds !== undefined) {
    $set.cooldownSeconds = Math.max(0, Number(patch.cooldownSeconds) || 0);
  }

  if (patch.permission !== undefined && Object.values(PERMISSIONS).includes(patch.permission)) {
    $set.permission = patch.permission;
  }

  if (!Object.keys($set).length) return TwitchCommandDb.findById(commandId).lean();

  return TwitchCommandDb.findByIdAndUpdate(commandId, { $set }, { new: true }).lean();
}

async function toggleCommandActive(commandId, guildId) {
  const command = await _requireOwnCommand(commandId, guildId);
  return TwitchCommandDb.findByIdAndUpdate(
    commandId, { $set: { active: !command.active } }, { new: true },
  ).lean();
}

async function deleteCommand(commandId, guildId) {
  await _requireOwnCommand(commandId, guildId);
  await TwitchCommandDb.deleteOne({ _id: commandId });
}

async function resolveCommand(guildId, messageText, platform = PLATFORM) {
  const first = String(messageText || '').trim().split(/\s+/)[0] || '';
  const trigger = normalizeTrigger(first);
  if (!trigger) return null;

  return TwitchCommandDb.findOne({ guildId, platform, trigger, active: true }).lean();
}

function userRank(badges = {}) {
  if (badges.broadcaster) return PERMISSION_RANK[PERMISSIONS.BROADCASTER];
  if (badges.moderator)   return PERMISSION_RANK[PERMISSIONS.MODERATOR];
  if (badges.vip || badges.subscriber) return PERMISSION_RANK[PERMISSIONS.VIP];
  return PERMISSION_RANK[PERMISSIONS.EVERYONE];
}

function canUseCommand(command, badges = {}) {
  const required = PERMISSION_RANK[command.permission] ?? 0;
  return userRank(badges) >= required;
}

function isOnCooldown(command) {
  if (!command.lastUsedAt || !command.cooldownSeconds) return false;
  const elapsedMs = Date.now() - new Date(command.lastUsedAt).getTime();
  return elapsedMs < command.cooldownSeconds * 1000;
}

function renderResponse(template, ctx = {}) {
  const uptime = ctx.startedAt
    ? formatUptime(Date.now() - new Date(ctx.startedAt).getTime())
    : '—';

  return String(template)
    .replaceAll('{user}',    ctx.userDisplayName || ctx.userLogin || '')
    .replaceAll('{channel}', ctx.channelDisplayName || ctx.channelLogin || '')
    .replaceAll('{game}',    ctx.game || '—')
    .replaceAll('{titulo}',  ctx.title || '—')
    .replaceAll('{uptime}',  uptime)
    .replaceAll('{url}',     ctx.channelLogin ? `https://twitch.tv/${ctx.channelLogin}` : '')
    .replaceAll('{count}',   String((ctx.usageCount ?? 0) + 1));
}

function formatUptime(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${m}min` : `${m}min`;
}

async function registerUsage(commandId, viewerLogin) {
  return TwitchCommandDb.findByIdAndUpdate(commandId, {
    $inc: { usageCount: 1 },
    $set: { lastUsedAt: new Date(), lastUsedBy: viewerLogin || null },
  }, { new: true }).lean();
}

module.exports = {
  PERMISSIONS,
  CommandNotFoundError,
  DuplicateTriggerError,
  normalizeTrigger,
  listCommands,
  getCommand,
  createCommand,
  updateCommand,
  toggleCommandActive,
  deleteCommand,
  resolveCommand,
  canUseCommand,
  isOnCooldown,
  renderResponse,
  registerUsage,
};
