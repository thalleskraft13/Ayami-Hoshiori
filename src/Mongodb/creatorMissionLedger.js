'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PLATFORMS } = require('./creatorAccountLink.js');

/**
 * FASE 5 — Histórico append-only de eventos de Missões de Criador.
 *
 * Segue o mesmo padrão de ServerBankLedger (site/models/bankLedger.js
 * / Ayami/src/Mongodb/bankLedger.js) aplicado às Missões: cada linha é
 * um evento imutável (nunca é editada, só criada), usado para
 * "consultar histórico" e para futuras Estatísticas (lives assistidas,
 * tempo acompanhado, streak, missões concluídas, recompensas
 * recebidas).
 *
 * Ele ESPELHA EXATAMENTE site/models/creatorMissionLedger.js — mesma
 * `collection`, mesmos campos.
 *
 * IMPORTANTE (isolamento obrigatório): este ledger é EXCLUSIVO da
 * integração de Missões de Criador. Nunca é escrito por, nem
 * alimenta, o Banco do Servidor/Economia — são coleções e domínios
 * totalmente separados.
 */

const EVENT_TYPES = Object.freeze({
  STARTED:          'started',           // usuário começou a participar da missão
  PROGRESS:         'progress',          // progresso incrementado
  COMPLETED:        'completed',         // missão concluída
  REWARD_REGISTERED:'reward_registered', // recompensa (estrutural) registrada
});

const creatorMissionLedgerSchema = new Schema({
  missionId: { type: Schema.Types.ObjectId, ref: 'CreatorMission', required: true },
  guildId:   { type: String, required: true },
  platform:  { type: String, required: true, enum: PLATFORMS },

  discordUserId:  { type: String, required: true },
  platformUserId: { type: String, default: null },

  event: { type: String, required: true, enum: Object.values(EVENT_TYPES) },

  // Valores relevantes no momento do evento (auditoria) — nunca
  // relacionados a moeda/saldo.
  progressBefore: { type: Number, default: null },
  progressAfter:  { type: Number, default: null },

  metadata: { type: Schema.Types.Mixed, default: null },

  criadoEm: { type: Date, default: Date.now },
}, {
  collection: 'creator_mission_ledger',
});

creatorMissionLedgerSchema.index({ guildId: 1, discordUserId: 1, criadoEm: -1 });
creatorMissionLedgerSchema.index({ missionId: 1, criadoEm: -1 });

module.exports = mongoose.models.CreatorMissionLedger
  || mongoose.model('CreatorMissionLedger', creatorMissionLedgerSchema);

module.exports.EVENT_TYPES = EVENT_TYPES;
