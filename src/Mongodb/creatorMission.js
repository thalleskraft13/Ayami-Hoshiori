'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PLATFORMS } = require('./creatorAccountLink.js');

/**
 * FASE 5 — Infraestrutura de Missões de Criador (Twitch e, futuramente,
 * YouTube/TikTok/Kick — ver `platform`).
 *
 * Define UMA missão configurada por um servidor (ex.: "assista a live
 * hoje", "acompanhe 30 minutos de transmissão", "mantenha uma
 * sequência de 3 lives seguidas"). Este model é a BASE do sistema —
 * aqui só é criada a infraestrutura; o catálogo de missões finais é
 * populado em fases futuras usando esta mesma estrutura.
 *
 * Ele ESPELHA EXATAMENTE site/models/creatorMission.js — mesma
 * `collection`, mesmos campos, mesmos índices. Não é uma cópia de
 * dados: é o MESMO documento Mongo, acessado por outro processo (a
 * Dashboard), igual ao padrão já usado em creatorAccountLink,
 * twitchChannel, etc. Qualquer alteração de schema precisa ser
 * replicada nos dois arquivos.
 *
 * Identificação de participação SEMPRE via Discord User ID ↔
 * Platform User ID (resolvidos por CreatorAccountLink através de
 * CreatorMissionService) — nunca nome, login, display name ou avatar.
 *
 * Isolamento obrigatório (Fase 5): este model e tudo que ele alimenta
 * NUNCA referenciam Bank/BankAccount/BankLedger ou qualquer coleção
 * de economia/moeda. O campo `reward` é só uma ESTRUTURA de
 * preparação para recompensas futuras — não entrega saldo, moeda ou
 * item de economia nenhum.
 *
 * Genérico por plataforma: `platform` reaproveita o mesmo catálogo de
 * CreatorAccountLink (PLATFORMS). Uma futura missão de YouTube/
 * TikTok/Kick usa este MESMO model — basta um novo valor de
 * `platform`. Nenhuma coleção nova deve ser criada por plataforma.
 */

// Tipos de missão previstos pela infraestrutura. O comportamento de
// cada tipo (como o progresso é incrementado) é implementado pelos
// consumidores (monitoramento de lives, comandos, Logic Script, ...)
// através de CreatorMissionService — este model só descreve o "o quê".
const MISSION_TYPES = Object.freeze({
  WATCH_STREAM:   'watch_stream',        // assistir/acompanhar N transmissões
  WATCH_DURATION: 'watch_duration',      // acompanhar N minutos de transmissão
  STREAK:         'streak',              // manter uma sequência de N lives/dias
  EVENT:          'event_participation', // participar de um evento pontual da live
  CUSTOM:         'custom',              // objetivo genérico, controlado por fora (ex.: Logic Script)
});

// Renovação da missão — prepara as categorias "Diárias" / "Semanais"
// já previstas no painel de Missões da Twitch (TwitchConfigSystem).
const PERIODS = Object.freeze({
  ONCE:    'once',
  DAILY:   'daily',
  WEEKLY:  'weekly',
  MONTHLY: 'monthly',
});

const goalSchema = new Schema({
  target: { type: Number, default: 1 },    // valor alvo — significado depende de `type`
  unit:   { type: String, default: null }, // rótulo livre pra exibição (ex.: "minutos", "lives")
}, { _id: false });

// Estrutura de recompensa — SOMENTE preparação (Fase 5). Nunca moeda,
// saldo ou qualquer valor de economia. `type` nunca deve ser
// "currency"/"coins" — reforçado também na validação do service.
const rewardSchema = new Schema({
  type:        { type: String, default: null }, // ex.: 'badge', 'role', 'custom'
  description: { type: String, default: null }, // texto livre definido pelo admin do servidor
}, { _id: false });

const creatorMissionSchema = new Schema({
  guildId:  { type: String, required: true },
  platform: { type: String, required: true, enum: PLATFORMS },

  // Slug único por servidor+plataforma (ex.: "assistir-live-01").
  key:  { type: String, required: true },
  type: { type: String, required: true, enum: Object.values(MISSION_TYPES) },

  title:       { type: String, required: true },
  description: { type: String, default: '' },

  goal:   { type: goalSchema, default: () => ({}) },
  period: { type: String, enum: Object.values(PERIODS), default: PERIODS.ONCE },

  // Gate por plano — reaproveita o catálogo já existente de
  // PremiumPlans.js (FREE / NOVA_ESTRELA / LUA_CRESCENTE /
  // CONSTELLATION). Não cria um sistema de permissões novo.
  requiredPlan: { type: String, default: 'FREE' },

  active:    { type: Boolean, default: true },
  createdBy: { type: String, default: null }, // Discord User ID de quem criou

  reward: { type: rewardSchema, default: () => ({}) },
}, {
  timestamps: true,
  collection: 'creator_missions',
});

creatorMissionSchema.index({ guildId: 1, platform: 1, key: 1 }, { unique: true });
creatorMissionSchema.index({ guildId: 1, platform: 1, active: 1 });

module.exports = mongoose.models.CreatorMission
  || mongoose.model('CreatorMission', creatorMissionSchema);

module.exports.MISSION_TYPES = MISSION_TYPES;
module.exports.PERIODS = PERIODS;
