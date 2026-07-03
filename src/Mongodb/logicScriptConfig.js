'use strict';

/* ═══════════════════════════════════════════
   LOGIC SCRIPT — CONFIG SCHEMA
   Configurações por guild: prefixo, etc.
   Arquivo: src/Mongodb/logicScriptConfig.js
   ═══════════════════════════════════════════ */

const { Schema, model, models } = require('mongoose');

const logicScriptConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  prefix:  { type: String, default: '!' },        // prefixo de comandos
  enabled: { type: Boolean, default: true },       // ativar/desativar todo o sistema
  ignoreBots:    { type: Boolean, default: true }, // ignorar mensagens de bots
  ignoredRoles:  { type: [String], default: [] },  // cargos que ignoram scripts
  updatedAt: { type: Date, default: Date.now },
});

module.exports = {
  LogicScriptConfig: models.LogicScriptConfig || model('LogicScriptConfig', logicScriptConfigSchema),
};
