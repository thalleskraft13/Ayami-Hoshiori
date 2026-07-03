'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Log de comandos (seção 4) — persistido pra permitir consulta histórica
 * depois (ex: "tudo que o usuário X rodou"). TTL de 30 dias: depois disso
 * o Mongo apaga o documento sozinho (não precisa de cron/job manual).
 */
const commandLogSchema = new Schema({
  commandName:    { type: String, required: true, index: true },
  subcommandName: { type: String, default: null },
  options:        { type: Schema.Types.Mixed, default: {} }, // interaction.data.options já estruturado pelo Discord
  guildId:        { type: String, default: null, index: true },
  guildName:      { type: String, default: null },
  userId:         { type: String, required: true, index: true },
  username:       { type: String, default: null },
  createdAt:      { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // TTL: 30 dias
}, {
  collection: 'command_logs',
});

module.exports = mongoose.models.CommandLog || mongoose.model('CommandLog', commandLogSchema);
