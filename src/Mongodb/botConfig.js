'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Config global do bot (singleton — um único documento, key: "global").
 *
 * - `presence`: última presence definida via comando (seção 6). Lida no
 *   boot de cada cluster pra sobreviver a restarts.
 *
 * (A lista de staff global NÃO fica aqui — segue o mesmo padrão hardcoded
 * já usado pelo eval em MessageCollectorManager.js, ver Utils/StaffIds.js.)
 */
const presenceSchema = new Schema({
  name:   { type: String, default: null },
  type:   { type: Number, default: 0 },
  status: { type: String, default: 'online' },
  url:    { type: String, default: null },
  state:  { type: String, default: null },
}, { _id: false });

const botConfigSchema = new Schema({
  key:      { type: String, default: 'global', unique: true },
  presence: { type: presenceSchema, default: null },
}, {
  collection: 'bot_config',
});

const BotConfigModel = mongoose.models.BotConfig || mongoose.model('BotConfig', botConfigSchema);

module.exports = BotConfigModel;
