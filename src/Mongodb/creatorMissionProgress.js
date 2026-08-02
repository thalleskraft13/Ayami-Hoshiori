'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PLATFORMS } = require('./creatorAccountLink.js');

/**
 * FASE 5 — Progresso/participação de um usuário Discord numa Missão
 * de Criador (CreatorMission).
 *
 * Um documento por (missão, usuário Discord). Guarda o ESTADO atual
 * (progresso acumulado, se já concluiu, se a recompensa já foi
 * "registrada" — nunca entregue em moeda). O HISTÓRICO append-only de
 * eventos fica em CreatorMissionLedger.
 *
 * Ele ESPELHA EXATAMENTE site/models/creatorMissionProgress.js —
 * mesma `collection`, mesmos campos, mesmos índices. Mesmo documento
 * Mongo, acessado por dois processos (Bot + Dashboard).
 *
 * Identificação SEMPRE via IDs oficiais:
 *   - discordUserId    → quem é, do lado da Ayami/Discord.
 *   - platformUserId   → quem é, do lado da plataforma (Twitch, etc),
 *                         resolvido a partir de CreatorAccountLink no
 *                         momento em que o progresso é registrado.
 * `platformUserId` aqui é um SNAPSHOT (auditoria de qual conta estava
 * vinculada quando a participação aconteceu) — nunca é usado como
 * chave de busca; a chave de identidade continua sendo discordUserId.
 *
 * `target` é uma cópia do `goal.target` da missão no momento em que o
 * progresso foi criado — assim, editar a missão depois não altera
 * retroativamente o objetivo de quem já estava participando.
 */

const rewardStateSchema = new Schema({
  // 'pending'   → missão concluída, recompensa (estrutural) ainda não registrada.
  // 'registered'→ recompensa registrada (estrutura apenas — sem entrega de moeda/saldo).
  status:       { type: String, enum: ['pending', 'registered'], default: 'pending' },
  registeredAt: { type: Date, default: null },
}, { _id: false });

const creatorMissionProgressSchema = new Schema({
  missionId: { type: Schema.Types.ObjectId, ref: 'CreatorMission', required: true },

  guildId:  { type: String, required: true }, // denormalizado — consultas por servidor sem popular a missão
  platform: { type: String, required: true, enum: PLATFORMS },

  discordUserId:  { type: String, required: true },
  platformUserId: { type: String, required: true }, // snapshot — nunca usado como chave de busca de identidade

  progress: { type: Number, default: 0 },
  target:   { type: Number, default: 1 }, // snapshot de goal.target no momento da participação

  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },

  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },

  reward: { type: rewardStateSchema, default: () => ({}) },
}, {
  timestamps: true,
  collection: 'creator_mission_progress',
});

// Um usuário só tem UM documento de progresso por missão.
creatorMissionProgressSchema.index({ missionId: 1, discordUserId: 1 }, { unique: true });
creatorMissionProgressSchema.index({ guildId: 1, discordUserId: 1 });
creatorMissionProgressSchema.index({ discordUserId: 1, platform: 1 });

module.exports = mongoose.models.CreatorMissionProgress
  || mongoose.model('CreatorMissionProgress', creatorMissionProgressSchema);
