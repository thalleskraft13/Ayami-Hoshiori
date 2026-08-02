'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Vínculo entre um usuário Discord (Ayami) e uma conta em uma plataforma
 * de criador (Twitch, YouTube, TikTok, Kick, ...).
 *
 * Este model é o núcleo do sistema de Vinculação Discord ↔ Plataformas.
 * Ele é ESPELHADO em site/projects/ayami-fixed/models/creatorAccountLink.js
 * — mesma `collection`, mesmos campos, mesmos índices. Não existe
 * "sincronização" entre Bot e Dashboard: os dois processos leem/escrevem
 * o MESMO documento Mongo (mesma convenção usada em activityDailyStat,
 * userglobal, etc). Qualquer alteração de schema precisa ser replicada
 * nos dois arquivos.
 *
 * Regras de negócio (garantidas via índices únicos, não só em código):
 *   - Uma conta da plataforma (platform + platformUserId) só pode estar
 *     vinculada a UM usuário Discord por vez.
 *   - Um usuário Discord só pode ter UM vínculo ativo por plataforma
 *     (platform + discordUserId).
 *   - Identificação NUNCA usa login/nome — sempre platformUserId (ID
 *     oficial da plataforma), conforme especificado.
 *
 * Novas plataformas (YouTube, TikTok, Kick, ...) reaproveitam este MESMO
 * model — basta usar um novo valor de `platform`. Nenhuma estrutura nova
 * deve ser criada para plataformas futuras.
 */

const PLATFORMS = Object.freeze(['twitch', 'youtube', 'tiktok', 'kick']);

const STATUSES = Object.freeze({
  CONNECTED: 'connected', // token válido, sincronizando normalmente
  ERROR: 'error', // falha ao renovar/usar o token (precisa reconectar)
  EXPIRED: 'expired', // refresh token expirado/revogado pela plataforma
  DISCONNECTED: 'disconnected', // desvinculado pelo usuário (registro mantido para auditoria)
});

const oauthSchema = new Schema({
  accessToken: { type: String, default: null },
  refreshToken: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  scopes: { type: [String], default: [] },
}, { _id: false });

const statsSchema = new Schema({
  livesAcompanhadas: { type: Number, default: 0 },
  horasAssistidas: { type: Number, default: 0 },
  streakAtual: { type: Number, default: 0 },
  maiorStreak: { type: Number, default: 0 },
  ultimaAtividadeEm: { type: Date, default: null },
  missoesConcluidas: { type: Number, default: 0 },
  recompensasRecebidas: { type: Number, default: 0 },
}, { _id: false });

const creatorAccountLinkSchema = new Schema({
  // Identificadores principais — SEMPRE IDs oficiais, nunca nomes.
  discordUserId: { type: String, required: true },
  platform: { type: String, required: true, enum: PLATFORMS },
  platformUserId: { type: String, required: true },

  // Informações de exibição (cache — atualizadas a cada sincronização,
  // nunca usadas como chave de identificação).
  platformLogin: { type: String, default: null },
  displayName: { type: String, default: null },
  avatarUrl: { type: String, default: null },

  // OAuth da plataforma (guardar aqui evita um segundo model por
  // plataforma; segue o mesmo padrão de armazenamento usado pela
  // sessão OAuth do Discord no Dashboard).
  oauth: { type: oauthSchema, default: () => ({}) },

  status: { type: String, enum: Object.values(STATUSES), default: STATUSES.CONNECTED },
  lastError: { type: String, default: null },

  linkedAt: { type: Date, default: Date.now },
  unlinkedAt: { type: Date, default: null },
  lastSyncedAt: { type: Date, default: null },

  // Reservado para Estatísticas (aparecerá futuramente no perfil do
  // usuário). Preenchido pelos serviços de missões/monitoramento.
  stats: { type: statsSchema, default: () => ({}) },
}, {
  timestamps: true,
  collection: 'creator_account_links',
});

// Uma conta da plataforma só pode pertencer a um usuário Discord.
creatorAccountLinkSchema.index(
  { platform: 1, platformUserId: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: STATUSES.DISCONNECTED } } },
);

// Um usuário Discord só pode ter um vínculo ativo por plataforma.
creatorAccountLinkSchema.index(
  { platform: 1, discordUserId: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: STATUSES.DISCONNECTED } } },
);

creatorAccountLinkSchema.index({ discordUserId: 1 });

module.exports = mongoose.models.CreatorAccountLink
  || mongoose.model('CreatorAccountLink', creatorAccountLinkSchema);

module.exports.PLATFORMS = PLATFORMS;
module.exports.STATUSES = STATUSES;
