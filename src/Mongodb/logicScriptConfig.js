'use strict';

const { Schema, model, models } = require('mongoose');

const logicScriptConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  prefix:  { type: String, default: '!' },
  enabled: { type: Boolean, default: true },
  ignoreBots:    { type: Boolean, default: true },
  ignoredRoles:  { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = {
  LogicScriptConfig: models.LogicScriptConfig || model('LogicScriptConfig', logicScriptConfigSchema),
};
