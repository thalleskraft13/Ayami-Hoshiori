'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Análise de Atividade — agregado diário por servidor.
 *
 * Um documento por (guildId, date). Atualizado em TEMPO REAL via $inc a
 * cada evento (mensagem, entrada/saída de membro) — não depende de jobs
 * em lote nem do TTL do ActivityEvent, então sobrevive indefinidamente
 * e alimenta os gráficos de crescimento diário/semanal/mensal, horários
 * de pico e dias da semana mais movimentados mesmo depois que os eventos
 * brutos expirarem.
 *
 * `date` é sempre a data no fuso UTC, formato 'YYYY-MM-DD' (ver
 * Activity/dateKey.js). Isso mantém os buckets estáveis independente do
 * fuso do processo que está rodando o bot.
 */
const activityDailyStatSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  date:    { type: String, required: true }, // 'YYYY-MM-DD' (UTC)

  messageCount: { type: Number, default: 0 },

  // Distribuição de mensagens por hora do dia (0-23, UTC) — usado em
  // "Horários de Pico". Array de tamanho fixo 24 para permitir $inc
  // posicional (messagesByHour.$[h]) sem precisar reler o documento.
  messagesByHour: {
    type: [Number],
    default: () => Array(24).fill(0)
  },

  newMembers:  { type: Number, default: 0 }, // entradas no servidor nesse dia
  leftMembers: { type: Number, default: 0 }, // saídas do servidor nesse dia

  // Snapshot preguiçoso (1x/dia) da contagem total de membros, usado
  // para calcular crescimento líquido dia-a-dia. Pode ficar `null` se
  // ainda não houve nenhuma chamada de snapshot nesse dia.
  memberCountEnd: { type: Number, default: null },

}, {
  collection: 'activity_daily_stats',
  timestamps: { createdAt: true, updatedAt: true }
});

activityDailyStatSchema.index({ guildId: 1, date: 1 }, { unique: true });

module.exports = mongoose.models.ActivityDailyStat
  || mongoose.model('ActivityDailyStat', activityDailyStatSchema);
