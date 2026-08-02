'use strict';

const CreatorMissionModel   = require('../../../Mongodb/creatorMission.js');
const CreatorMissionProgress= require('../../../Mongodb/creatorMissionProgress.js');
const CreatorMissionLedger  = require('../../../Mongodb/creatorMissionLedger.js');
const { EVENT_TYPES }       = CreatorMissionLedger;
const AccountLinkService    = require('../CreatorAccounts/AccountLinkService.js');

/**
 * FASE 5 — Engine genérico de Missões de Criador (Bot).
 *
 * Este é o ÚNICO ponto de entrada pra criar/consultar missões,
 * registrar progresso, concluir missões e consultar histórico. Nunca
 * duplicar esta lógica em cada plataforma (Twitch, YouTube, ...) —
 * este service já é genérico por `platform` (mesmo padrão do
 * CreatorAccountLink). Ele ESPELHA site/services/creatorMissionService.js
 * do lado da Dashboard — os dois lêem/escrevem os mesmos documentos
 * Mongo, nenhum estado é duplicado entre processos.
 *
 * Regra inegociável (Fase 5): identificação de usuários é SEMPRE via
 * Discord User ID ↔ Platform User ID, resolvidos através de
 * CreatorAccountLink/AccountLinkService — nunca nome, login, display
 * name ou avatar.
 *
 * Regra inegociável (Fase 5): nada aqui toca Bank/BankAccount/
 * BankLedger ou qualquer coleção de economia/moeda. `reward` é apenas
 * uma estrutura preparatória.
 */

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

/* ─────────────────────────────────────────────
   Missões (definição)
   ───────────────────────────────────────────── */

/** Lista as missões ativas de um servidor numa plataforma. */
async function listActiveMissions(guildId, platform) {
  return CreatorMissionModel.find({ guildId, platform, active: true }).lean();
}

/** Lista TODAS as missões de um servidor numa plataforma (painel de administração). */
async function listMissions(guildId, platform) {
  return CreatorMissionModel.find({ guildId, platform }).sort({ createdAt: -1 }).lean();
}

async function getMission(missionId) {
  return CreatorMissionModel.findById(missionId).lean();
}

/**
 * Cria uma missão. Reforça em código (além do schema) que `reward`
 * nunca descreve moeda/saldo — isso é responsabilidade de todo
 * consumidor deste service, bot ou Dashboard.
 */
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

  return CreatorMissionModel.create({
    guildId, platform, key, type, title, description, goal, period, requiredPlan, createdBy, reward,
  });
}

async function setMissionActive(missionId, active) {
  return CreatorMissionModel.findByIdAndUpdate(missionId, { $set: { active } }, { new: true }).lean();
}

/* ─────────────────────────────────────────────
   Verificação de vínculo (obrigatória antes de participar)
   ───────────────────────────────────────────── */

/**
 * Garante que existe um vínculo ativo Discord ↔ Plataforma antes de
 * qualquer participação. Lança NoLinkedAccountError (com a mensagem
 * padrão pedida na Fase 5) se não existir — quem chamar deve exibir
 * essa mensagem ao usuário, nunca registrar progresso sem vínculo.
 */
async function requireLinkedAccount(discordUserId, platform) {
  const link = await AccountLinkService.getLink(discordUserId, platform);
  if (!link || link.status !== 'connected') {
    throw new NoLinkedAccountError();
  }
  return link;
}

/* ─────────────────────────────────────────────
   Progresso / Participação
   ───────────────────────────────────────────── */

/** Progresso do usuário numa missão específica (ou null se nunca participou). */
async function getProgress(missionId, discordUserId) {
  return CreatorMissionProgress.findOne({ missionId, discordUserId }).lean();
}

/** Todo o progresso (histórico de estado) de um usuário num servidor. */
async function getUserProgressForGuild(discordUserId, guildId) {
  return CreatorMissionProgress.find({ discordUserId, guildId }).sort({ updatedAt: -1 }).lean();
}

/**
 * Garante (cria se preciso) o documento de progresso de um usuário
 * numa missão — SEMPRE após confirmar o vínculo (requireLinkedAccount).
 * Não deve ser chamado diretamente por consumidores externos; use
 * registerProgress, que já faz essa checagem.
 */
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

/**
 * Registra progresso de um usuário numa missão. Este é o ponto de
 * entrada que futuros consumidores (monitoramento de lives, comandos
 * do Discord, EventSub, Logic Script, ...) devem chamar.
 *
 * - SEMPRE verifica vínculo ativo antes de qualquer coisa (regra
 *   obrigatória da Fase 5). Se não houver vínculo, lança
 *   NoLinkedAccountError — quem chamar deve informar a mensagem
 *   "Conecte sua conta Twitch em Contas Conectadas para participar
 *   das missões." e não deve registrar nada.
 * - Não permite progresso em missão inativa/inexistente.
 * - Marca como concluída automaticamente ao atingir a meta e grava
 *   o evento no histórico (ledger).
 */
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

/**
 * Registra a recompensa (ESTRUTURAL — sem entregar moeda/saldo) de
 * uma missão já concluída. Preparado para uso futuro; por enquanto só
 * marca o status e grava o evento no histórico.
 */
async function registerReward(discordUserId, missionId) {
  const progressDoc = await CreatorMissionProgress.findOne({ missionId, discordUserId });
  if (!progressDoc || progressDoc.status !== 'completed') return null;
  if (progressDoc.reward?.status === 'registered') return progressDoc.toObject();

  progressDoc.reward = { status: 'registered', registeredAt: new Date() };
  await progressDoc.save();

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

/* ─────────────────────────────────────────────
   Histórico
   ───────────────────────────────────────────── */

async function getHistory(discordUserId, guildId, limit = 50) {
  return CreatorMissionLedger.find({ discordUserId, guildId })
    .sort({ criadoEm: -1 })
    .limit(limit)
    .lean();
}

module.exports = {
  NoLinkedAccountError,
  MissionNotFoundError,

  listActiveMissions,
  listMissions,
  getMission,
  createMission,
  setMissionActive,

  requireLinkedAccount,

  getProgress,
  getUserProgressForGuild,
  registerProgress,
  registerReward,

  getHistory,
};
