'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Análise de Atividade — marca "usuário X esteve ativo no servidor Y no
 * dia Z". Um documento por (guildId, date, userId), upsert (existência
 * apenas, sem contador) na primeira mensagem do usuário naquele dia.
 *
 * Serve para calcular "usuários ativos únicos" em qualquer janela
 * (dia/semana/mês) via `distinct('userId', {...})` ou contagem de
 * documentos, sem precisar guardar sets dentro de outro documento
 * (o que ficaria caro de atualizar em servidores grandes).
 *
 * TTL de 400 dias: dá pra calcular "ativos no mês" e até comparativos
 * anuais simples, mas evita crescer pra sempre em servidores muito
 * grandes e antigos.
 */
const activityDailyUserSchema = new Schema({
  guildId: { type: String, required: true },
  date:    { type: String, required: true }, // 'YYYY-MM-DD' (UTC)
  userId:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 400 },
}, {
  collection: 'activity_daily_users',
});

activityDailyUserSchema.index({ guildId: 1, date: 1, userId: 1 }, { unique: true });
activityDailyUserSchema.index({ guildId: 1, date: 1 });

module.exports = mongoose.models.ActivityDailyUser
  || mongoose.model('ActivityDailyUser', activityDailyUserSchema);
