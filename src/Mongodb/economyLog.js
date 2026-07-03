'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Log de economia persistido (seção 8) — antes, `Economy._sendLog` só
 * mandava a mensagem pro canal de log e nunca gravava nada no banco (então
 * não dava pra auditar depois, só via histórico do Discord). Sem TTL de
 * propósito: registro financeiro, diferente do log de comandos.
 */
const economyLogSchema = new Schema({
  userId:           { type: String, required: true, index: true },
  action:           { type: String, required: true }, // add | remove | reset | banner_pull
  previousBalance:  { type: Number, required: true },
  amount:            { type: Number, required: true },
  currentBalance:   { type: Number, required: true },
  difference:       { type: Number, required: true },
  // Preenchido só quando o log vem de um gacha pull (seção 8 — "moeda +
  // personagens de gacha"): quais personagens saíram nesse pull.
  characters:       { type: [{ item: String, tipo: Number, novo: Boolean, constelacao: Number }], default: undefined },
  bannerId:         { type: Schema.Types.Mixed, default: null },
  createdAt:        { type: Date, default: Date.now },
}, {
  collection: 'economy_logs',
});

module.exports = mongoose.models.EconomyLog || mongoose.model('EconomyLog', economyLogSchema);
