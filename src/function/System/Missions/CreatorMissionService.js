'use strict';

const CreatorMissionModel   = require('../../../Mongodb/creatorMission.js');
const { MISSION_TYPES, PERIODS } = CreatorMissionModel;
const CreatorMissionProgress= require('../../../Mongodb/creatorMissionProgress.js');
const CreatorMissionLedger  = require('../../../Mongodb/creatorMissionLedger.js');
const { EVENT_TYPES }       = CreatorMissionLedger;
const AccountLinkService    = require('../CreatorAccounts/AccountLinkService.js');
const { GuildDb } = require('../../../Mongodb/guild.js');
const { getPlan, resolveActivePlan } = require('../../Utils/PremiumPlans.js');
const DiscordRequest = require('../../DiscordRequest.js');
const CV2             = require('../../Messages/CV2.js');

const REWARD_ACCENT = 0x9146FF;

class NoLinkedAccountError extends Error {
  constructor() {
    super('Conecte sua conta Twitch em Contas Conectadas para participar das missões.');
    this.code = 'NO_LINKED_ACCOUNT';
  }
}

class MissionNotFoundError extends Error {
  constructor() {
    super('Missão não encontrada ou não está mais ativa.');
    this.code = 'MISSION_NOT_FOUND';
  }
}

async function listActiveMissions(guildId, platform) {
  return CreatorMissionModel.find({ guildId, platform, active: true }).lean();
}

async function listMissions(guildId, platform) {
  return CreatorMissionModel.find({ guildId, platform }).sort({ createdAt: -1 }).lean();
}

async function getMission(missionId) {
  return CreatorMissionModel.findById(missionId).lean();
}

async function _guildMissionLimit(guildId) {
  const guildDoc = await GuildDb.findOne({ guildId }).lean();
  const plan = getPlan(resolveActivePlan(guildDoc));
  return { plan, limit: plan.twitchMissionLimit ?? 0 };
}

async function createMission({
  guildId,
  platform,
  key,
  type,
  title,
  description = '',
  goal = {},
  period = 'once',
  requiredPlan = 'FREE',
  createdBy = null,
  reward = null,
}) {
  if (reward?.type && ['currency', 'coins', 'saldo', 'moeda'].includes(String(reward.type).toLowerCase())) {
    throw new Error('Missões de Criador não podem entregar moeda/saldo — apenas estruturas de recompensa (badge, cargo, texto customizado).');
  }

          const { plan, limit } = await _guildMissionLimit(guildId);
  const totalAtual = await CreatorMissionModel.countDocuments({ guildId, platform });
  if (totalAtual >= limit) {
    throw new Error(`Limite de missões do plano ${plan.name} atingido (${limit}). Remova uma missão existente ou faça upgrade do servidor para criar mais.`);
  }

  return CreatorMissionModel.create({
    guildId, platform, key, type, title, description, goal, period, requiredPlan, createdBy, reward,
  });
}

async function setMissionActive(missionId, active) {
  return CreatorMissionModel.findByIdAndUpdate(missionId, { $set: { active } }, { new: true }).lean();
}

async function updateMission(missionId, patch = {}) {
  if (patch.reward?.type && ['currency', 'coins', 'saldo', 'moeda'].includes(String(patch.reward.type).toLowerCase())) {
    throw new Error('Missões de Criador não podem entregar moeda/saldo — apenas estruturas de recompensa (badge, cargo, texto customizado).');
  }

  const $set = {};
  for (const campo of ['title', 'description', 'goal', 'type', 'period', 'requiredPlan', 'reward']) {
    if (Object.prototype.hasOwnProperty.call(patch, campo)) $set[campo] = patch[campo];
  }

  return CreatorMissionModel.findByIdAndUpdate(missionId, { $set }, { new: true }).lean();
}

async function deleteMission(missionId) {
  await CreatorMissionProgress.deleteMany({ missionId });
  await CreatorMissionModel.deleteOne({ _id: missionId });
}

async function requireLinkedAccount(discordUserId, platform) {
  const link = await AccountLinkService.getLink(discordUserId, platform);
  if (!link || link.status !== 'connected') {
    throw new NoLinkedAccountError();
  }
  return link;
}

async function getProgress(missionId, discordUserId) {
  return CreatorMissionProgress.findOne({ missionId, discordUserId }).lean();
}

async function getUserProgressForGuild(discordUserId, guildId) {
  return CreatorMissionProgress.find({ discordUserId, guildId }).sort({ updatedAt: -1 }).lean();
}

async function _ensureProgress(mission, discordUserId, platformUserId) {
  const existing = await CreatorMissionProgress.findOne({ missionId: mission._id, discordUserId });
  if (existing) return existing;

  const created = await CreatorMissionProgress.create({
    missionId: mission._id,
    guildId: mission.guildId,
    platform: mission.platform,
    discordUserId,
    platformUserId,
    progress: 0,
    target: mission.goal?.target ?? 1,
    status: 'in_progress',
  });

  await CreatorMissionLedger.create({
    missionId: mission._id,
    guildId: mission.guildId,
    platform: mission.platform,
    discordUserId,
    platformUserId,
    event: EVENT_TYPES.STARTED,
    progressBefore: null,
    progressAfter: 0,
  });

  return created;
}

async function registerProgress(discordUserId, missionId, amount = 1) {
  const mission = await CreatorMissionModel.findOne({ _id: missionId, active: true }).lean();
  if (!mission) throw new MissionNotFoundError();

  const link = await requireLinkedAccount(discordUserId, mission.platform);

  const progressDoc = await _ensureProgress(mission, discordUserId, link.platformUserId);
  if (progressDoc.status === 'completed') return progressDoc.toObject ? progressDoc.toObject() : progressDoc;

  const before = progressDoc.progress;
  const after  = Math.min(progressDoc.target, before + Math.max(0, amount));

  progressDoc.progress = after;

  const justCompleted = after >= progressDoc.target;
  if (justCompleted) {
    progressDoc.status = 'completed';
    progressDoc.completedAt = new Date();
  }

  await progressDoc.save();

  await CreatorMissionLedger.create({
    missionId: mission._id,
    guildId: mission.guildId,
    platform: mission.platform,
    discordUserId,
    platformUserId: link.platformUserId,
    event: EVENT_TYPES.PROGRESS,
    progressBefore: before,
    progressAfter: after,
  });

  if (justCompleted) {
    await CreatorMissionLedger.create({
      missionId: mission._id,
      guildId: mission.guildId,
      platform: mission.platform,
      discordUserId,
      platformUserId: link.platformUserId,
      event: EVENT_TYPES.COMPLETED,
      progressBefore: before,
      progressAfter: after,
    });
  }

  return progressDoc.toObject();
}

async function registerReward(discordUserId, missionId) {
  const progressDoc = await CreatorMissionProgress.findOne({ missionId, discordUserId });
  if (!progressDoc || progressDoc.status !== 'completed') return null;
  if (progressDoc.reward?.status === 'registered') return progressDoc.toObject();

  progressDoc.reward = { status: 'registered', registeredAt: new Date() };
  await progressDoc.save();

  const mission = await CreatorMissionModel.findById(progressDoc.missionId).lean();

  if (mission?.reward?.type === 'role' && mission.reward.roleId) {
    await DiscordRequest(`/guilds/${progressDoc.guildId}/members/${discordUserId}/roles/${mission.reward.roleId}`, {
      method: 'PUT',
    }).catch((err) =>
      console.error(`[CreatorMissionService] Falha ao atribuir cargo de recompensa da missão ${missionId}:`, err.message));
  }

  if (mission?.reward?.logChannelId) {
    const container = CV2.container([
      CV2.text(
        `🧩 **Recompensa registrada — ${mission.title}**\n` +
        `<@${discordUserId}> concluiu a missão e teve a recompensa registrada.` +
        (mission.reward.description ? `\n${mission.reward.description}` : ''),
      ),
    ], { accentColor: REWARD_ACCENT });

    await DiscordRequest(`/channels/${mission.reward.logChannelId}/messages`, {
      method: 'POST',
      body: {
        flags:            CV2.IS_COMPONENTS_V2,
        components:       [container],
        allowed_mentions: { parse: [] },
      },
    }).catch((err) =>
      console.error(`[CreatorMissionService] Falha ao publicar log de recompensa da missão ${missionId}:`, err.message));
  }

  await CreatorMissionLedger.create({
    missionId: progressDoc.missionId,
    guildId: progressDoc.guildId,
    platform: progressDoc.platform,
    discordUserId,
    platformUserId: progressDoc.platformUserId,
    event: EVENT_TYPES.REWARD_REGISTERED,
    progressBefore: progressDoc.progress,
    progressAfter: progressDoc.progress,
  });

  return progressDoc.toObject();
}

async function getHistory(discordUserId, guildId, limit = 50) {
  return CreatorMissionLedger.find({ discordUserId, guildId })
    .sort({ criadoEm: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  NoLinkedAccountError,
  MissionNotFoundError,

  MISSION_TYPES,
  PERIODS,

  listActiveMissions,
  listMissions,
  getMission,
  createMission,
  setMissionActive,
  updateMission,
  deleteMission,

  requireLinkedAccount,

  getProgress,
  getUserProgressForGuild,
  registerProgress,
  registerReward,

  getHistory,
};
