'use strict';

const TwitchAlertDb = require('../../../../Mongodb/twitchAlert.js');
const { TYPES, TYPE_LABELS, DEFAULT_MESSAGES } = TwitchAlertDb;
const CommandLog          = require('../../../../Mongodb/commandLog.js');
const { GuildDb }         = require('../../../../Mongodb/guild.js');
const AccountLinkService  = require('../../CreatorAccounts/AccountLinkService.js');
const DiscordRequest      = require('../../../DiscordRequest.js');
const CV2                 = require('../../../Messages/CV2.js');

const { getPlan, resolveActivePlan } = require('../../../Utils/PremiumPlans.js');

const PLATFORM = 'twitch';

const ALERT_LOG_COMMAND = 'twitch_alert';

const ACCENT_ALERT = 0x9146FF;

class AlertNotFoundError extends Error {
  constructor() {
    super('Alerta não encontrado neste servidor.');
    this.code = 'ALERT_NOT_FOUND';
  }
}

function isValidType(type) {
  return Object.values(TYPES).includes(type);
}

async function listAlerts(guildId, platform = PLATFORM) {
  return TwitchAlertDb.find({ guildId, platform }).sort({ createdAt: -1 }).lean();
}

async function listAlertsByType(guildId, type, platform = PLATFORM) {
  return TwitchAlertDb.find({ guildId, platform, type }).sort({ createdAt: -1 }).lean();
}

async function listActiveAlertsByType(guildId, type, platform = PLATFORM) {
  return TwitchAlertDb.find({ guildId, platform, type, active: true }).lean();
}

async function listGuildIdsWithActiveAlerts(type, platform = PLATFORM) {
  return TwitchAlertDb.distinct('guildId', { platform, type, active: true });
}

async function getAlert(alertId) {
  return TwitchAlertDb.findById(alertId).lean();
}

async function _guildAlertLimit(guildId) {
  const guildDoc = await GuildDb.findOne({ guildId }).lean();
  const plan = getPlan(resolveActivePlan(guildDoc));
  return { plan, limit: plan.twitchAlertLimit ?? 0 };
}

async function createAlert({
  guildId,
  platform = PLATFORM,
  type,
  discordChannelId,
  roleId = null,
  message,
  minAmount = null,
  createdBy = null,
}) {
  if (!isValidType(type)) throw new Error('Tipo de alerta inválido.');
  if (!String(discordChannelId || '').trim()) throw new Error('Selecione o canal onde o alerta será publicado.');

  
  
  
  
  const { plan, limit } = await _guildAlertLimit(guildId);
  const totalAtual = await TwitchAlertDb.countDocuments({ guildId, platform });
  if (totalAtual >= limit) {
    throw new Error(`Limite de alertas do plano ${plan.name} atingido (${limit}). Remova um alerta existente ou faça upgrade do servidor para criar mais.`);
  }

  const cleanMessage = String(message || '').trim() || DEFAULT_MESSAGES[type];

  return TwitchAlertDb.create({
    guildId,
    platform,
    type,
    discordChannelId,
    roleId: roleId || null,
    message: cleanMessage,
    minAmount: minAmount != null && minAmount !== '' ? Math.max(0, Number(minAmount) || 0) : null,
    createdBy,
  });
}

async function _requireOwnAlert(alertId, guildId) {
  const alert = await TwitchAlertDb.findById(alertId).lean();
  if (!alert || alert.guildId !== guildId) throw new AlertNotFoundError();
  return alert;
}

async function updateAlert(alertId, guildId, patch = {}) {
  await _requireOwnAlert(alertId, guildId);

  const $set = {};

  if (patch.discordChannelId !== undefined) {
    const channelId = String(patch.discordChannelId || '').trim();
    if (!channelId) throw new Error('Selecione o canal onde o alerta será publicado.');
    $set.discordChannelId = channelId;
  }

  if (patch.roleId !== undefined) {
    $set.roleId = patch.roleId || null;
  }

  if (patch.message !== undefined) {
    const message = String(patch.message || '').trim();
    if (!message) throw new Error('A mensagem do alerta não pode ficar vazia.');
    $set.message = message;
  }

  if (patch.minAmount !== undefined) {
    $set.minAmount = patch.minAmount != null && patch.minAmount !== ''
      ? Math.max(0, Number(patch.minAmount) || 0)
      : null;
  }

  if (!Object.keys($set).length) return TwitchAlertDb.findById(alertId).lean();

  return TwitchAlertDb.findByIdAndUpdate(alertId, { $set }, { new: true }).lean();
}

async function toggleAlertActive(alertId, guildId) {
  const alert = await _requireOwnAlert(alertId, guildId);
  return TwitchAlertDb.findByIdAndUpdate(
    alertId, { $set: { active: !alert.active } }, { new: true },
  ).lean();
}

async function deleteAlert(alertId, guildId) {
  await _requireOwnAlert(alertId, guildId);
  await TwitchAlertDb.deleteOne({ _id: alertId });
}

function renderMessage(template, ctx = {}) {
  return String(template)
    .replaceAll('{user}',    ctx.userDisplayName || ctx.userLogin || '')
    .replaceAll('{channel}', ctx.channelDisplayName || ctx.channelLogin || '')
    .replaceAll('{months}',  String(ctx.months ?? ''))
    .replaceAll('{tier}',    ctx.tier || '')
    .replaceAll('{bits}',    String(ctx.bits ?? ''))
    .replaceAll('{viewers}', String(ctx.viewers ?? ''))
    .replaceAll('{count}',   String(ctx.count ?? ''));
}

function _amountForType(type, ctx) {
  switch (type) {
    case TYPES.BITS:     return Number(ctx.bits ?? 0);
    case TYPES.RAID:     return Number(ctx.viewers ?? 0);
    case TYPES.GIFT_SUB: return Number(ctx.count ?? 1);
    default:              return null;
  }
}

function _passesThreshold(alert, ctx) {
  if (alert.minAmount == null) return true;
  const amount = _amountForType(alert.type, ctx);
  if (amount == null) return true;
  return amount >= alert.minAmount;
}

async function triggerAlert(guildId, type, ctx = {}) {
  if (!isValidType(type)) return;

  let alerts;
  try {
    alerts = await listActiveAlertsByType(guildId, type);
  } catch (err) {
    console.error('[TwitchAlertService] Falha ao listar alertas ativos:', err.message);
    return;
  }
  if (!alerts.length) return;

  
  
  
  let discordUserId = null;
  if (ctx.platformUserId) {
    try {
      discordUserId = await AccountLinkService.resolveDiscordUserId(PLATFORM, ctx.platformUserId);
    } catch (err) {
      console.error('[TwitchAlertService] Falha ao resolver vínculo Discord:', err.message);
    }
  }

  for (const alert of alerts) {
    if (!_passesThreshold(alert, ctx)) continue;
    await _dispatchOne(guildId, alert, ctx, discordUserId).catch((err) =>
      console.error(`[TwitchAlertService] Falha ao disparar alerta ${alert._id}:`, err.message));
  }
}

async function _dispatchOne(guildId, alert, ctx, discordUserId) {
  const texto = renderMessage(alert.message, ctx);

  const container = CV2.container([
    CV2.text(`${TYPE_LABELS[alert.type] ? `**${TYPE_LABELS[alert.type]}**\n` : ''}${texto}`),
  ], { accentColor: ACCENT_ALERT });

  await DiscordRequest(`/channels/${alert.discordChannelId}/messages`, {
    method: 'POST',
    body: {
      flags:            CV2.IS_COMPONENTS_V2,
      components:       [container],
      allowed_mentions: { parse: [] },
    },
  });

  if (alert.roleId && discordUserId) {
    await DiscordRequest(`/guilds/${guildId}/members/${discordUserId}/roles/${alert.roleId}`, {
      method: 'PUT',
    }).catch((err) =>
      console.error(`[TwitchAlertService] Falha ao atribuir cargo do alerta ${alert._id}:`, err.message));
  }

  await TwitchAlertDb.findByIdAndUpdate(alert._id, {
    $inc: { usageCount: 1 },
    $set: { lastTriggeredAt: new Date() },
  }).catch(() => {});

  
  CommandLog.create({
    commandName: ALERT_LOG_COMMAND,
    subcommandName: alert.type,
    options: { discordChannelId: alert.discordChannelId, viewerLogin: ctx.userLogin || null },
    guildId,
    guildName: null,
    userId: alert.createdBy || discordUserId || 'system',
    username: ctx.userDisplayName || ctx.userLogin || null,
  }).catch((err) => console.error('[TwitchAlertService] Falha ao registrar log de alerta:', err.message));
}

module.exports = {
  TYPES,
  TYPE_LABELS,
  DEFAULT_MESSAGES,
  AlertNotFoundError,
  isValidType,
  listAlerts,
  listAlertsByType,
  listActiveAlertsByType,
  listGuildIdsWithActiveAlerts,
  getAlert,
  createAlert,
  updateAlert,
  toggleAlertActive,
  deleteAlert,
  renderMessage,
  triggerAlert,
};
