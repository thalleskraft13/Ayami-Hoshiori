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

/**
 * Atualização Programada (seção "Sistema de Atualização Programada").
 * Singleton — um documento global. Persiste o estado pra sobreviver a
 * restarts e permitir que TODOS os clusters/shards enxerguem o mesmo
 * estado (a fonte de verdade é este documento; cada worker mantém um
 * cache em memória disso, ver function/Utils/MaintenanceMode.js).
 */
const maintenanceSchema = new Schema({
  active:      { type: Boolean, default: false },
  message:     { type: String,  default: null },
  activatedBy: { type: String,  default: null },
  activatedAt: { type: Number,  default: null },
}, { _id: false });

const botConfigSchema = new Schema({
  key:         { type: String, default: 'global', unique: true },
  presence:    { type: presenceSchema,    default: null },
  maintenance: { type: maintenanceSchema, default: () => ({}) },
}, {
  collection: 'bot_config',
});

const BotConfigModel = mongoose.models.BotConfig || mongoose.model('BotConfig', botConfigSchema);

module.exports = BotConfigModel;
