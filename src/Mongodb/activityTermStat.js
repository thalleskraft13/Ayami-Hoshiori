'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Análise de Atividade — contador diário por termo, agrupado por `kind`.
 *
 * Um único modelo cobre três métricas diferentes do pedido original:
 *   - kind: 'word'     → "Tópicos Mais Discutidos" / "Palavras em Tendência"
 *   - kind: 'emoji'     → "Emojis Mais Utilizados"
 *   - kind: 'reaction'  → "Reações Mais Utilizadas"
 *
 * Bucket por dia (em vez de um contador único) permite calcular
 * TENDÊNCIA (comparar a soma de uma janela recente com a de uma janela
 * anterior), não só o total acumulado. Somar os buckets de qualquer
 * intervalo também dá o "mais usado no período X" sem precisar de outra
 * coleção.
 *
 * TTL de 120 dias: tendência e "mais discutido" só fazem sentido em
 * janelas relativamente recentes; isso evita a coleção crescer sem
 * limite em servidores grandes com vocabulário muito variado.
 */
const activityTermStatSchema = new Schema({
  guildId: { type: String, required: true },
  kind:    { type: String, enum: ['word', 'emoji', 'reaction'], required: true },
  term:    { type: String, required: true }, // palavra normalizada, ID/nome do emoji, ou nome da reação
  date:    { type: String, required: true }, // 'YYYY-MM-DD' (UTC)

  count: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 120 },
}, {
  collection: 'activity_term_stats',
});

activityTermStatSchema.index({ guildId: 1, kind: 1, term: 1, date: 1 }, { unique: true });
activityTermStatSchema.index({ guildId: 1, kind: 1, date: 1 });

module.exports = mongoose.models.ActivityTermStat
  || mongoose.model('ActivityTermStat', activityTermStatSchema);
