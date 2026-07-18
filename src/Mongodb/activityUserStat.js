'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Análise de Atividade — contador acumulado por (guildId, userId).
 * Atualizado via $inc a cada mensagem/reação, sem TTL — alimenta o
 * "Ranking de Mensagens" e "Usuários Mais Ativos" (all-time), além de
 * servir de fallback para janelas maiores que a retenção do
 * ActivityEvent bruto.
 */
const activityUserStatSchema = new Schema({
  guildId: { type: String, required: true },
  userId:  { type: String, required: true },

  totalMessages:       { type: Number, default: 0 },
  totalReactionsGiven: { type: Number, default: 0 },

  firstMessageAt: { type: Date, default: null },
  lastMessageAt:  { type: Date, default: null },
}, {
  collection: 'activity_user_stats',
  timestamps: { createdAt: false, updatedAt: true }
});

activityUserStatSchema.index({ guildId: 1, userId: 1 }, { unique: true });
// Usado pelo ranking (top N por mensagens dentro do servidor)
activityUserStatSchema.index({ guildId: 1, totalMessages: -1 });

module.exports = mongoose.models.ActivityUserStat
  || mongoose.model('ActivityUserStat', activityUserStatSchema);
