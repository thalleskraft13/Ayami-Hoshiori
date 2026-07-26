'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Log genérico de movimentações de Estrelas.
// action: add | remove | reset | daily | transfer_send | transfer_receive | mission_reward | level_reward
const economyLogSchema = new Schema({
  userId:           { type: String, required: true, index: true },
  action:           { type: String, required: true },
  previousBalance:  { type: Number, required: true },
  amount:           { type: Number, required: true },
  currentBalance:   { type: Number, required: true },
  difference:       { type: Number, required: true },

  // Origem/destino, usados em transferências (usuário <-> usuário, futuramente Banco do Servidor)
  origin:           { type: String, default: null },
  destination:      { type: String, default: null },

  // Auditoria: quem executou a ação (author do log) e em qual servidor
  actorId:          { type: String, default: null },
  guildId:          { type: String, default: null },
  guildName:        { type: String, default: null },

  // Dados adicionais livres (motivo, id de missão, id de item, etc.)
  metadata:         { type: Schema.Types.Mixed, default: null },

  createdAt:        { type: Date, default: Date.now },
}, {
  collection: 'economy_logs',
});

module.exports = mongoose.models.EconomyLog || mongoose.model('EconomyLog', economyLogSchema);
