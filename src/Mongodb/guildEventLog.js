'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Histórico de entrada/saída de servidores (seção 5) — permite consultar
 * o crescimento do bot ao longo do tempo. Diferente de `guild.js` (GuildDb),
 * que guarda a config ATUAL do servidor: isto é um log append-only de eventos.
 */
const guildEventLogSchema = new Schema({
  guildId:     { type: String, required: true, index: true },
  guildName:   { type: String, default: null },
  ownerId:     { type: String, default: null },
  memberCount: { type: Number, default: 0 },
  event:       { type: String, enum: ['join', 'leave'], required: true },
  at:          { type: Date, default: Date.now },
}, {
  collection: 'guild_event_logs',
});

module.exports = mongoose.models.GuildEventLog || mongoose.model('GuildEventLog', guildEventLogSchema);
