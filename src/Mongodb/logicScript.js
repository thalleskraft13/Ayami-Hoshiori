'use strict';


const { Schema, model, models } = require('mongoose');

const logicScriptSchema = new Schema({
  guildId:   { type: String, required: true, index: true },
  name:      { type: String, required: true },
  path:      { type: String, required: true },
  content:   { type: String, default: '' },
  enabled:   { type: Boolean, default: true },
  isFolder:  { type: Boolean, default: false },

  hasError:               { type: Boolean, default: false },
  lastError:              { type: String,  default: null },
  wasEnabledBeforeError:  { type: Boolean, default: false },

  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  _astCache:     { type: Schema.Types.Mixed, default: null },
  _astCacheHash: { type: String, default: null },
});

logicScriptSchema.index({ guildId: 1, path: 1 }, { unique: true });

const logicRunLogSchema = new Schema({
  guildId:    { type: String, required: true, index: true },
  scriptPath: { type: String, required: true },
  event:      { type: String, default: null },
  status:     { type: String, enum: ['ok', 'error', 'timeout', 'warning'], default: 'ok' },
  error:      { type: String, default: null },
  errorLine:  { type: Number, default: null }, // linha do erro no .logic, quando disponível
  logs:       { type: [String], default: [] },  // saidas de print() capturadas
  steps:      { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  createdAt:  { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});

logicRunLogSchema.index({ guildId: 1, createdAt: -1 });

const lsVarSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  scope:   { type: String, enum: ['global', 'user', 'guild'], default: 'global' },
  ownerId: { type: String, default: null },
  key:     { type: String, required: true },
  value:   { type: Schema.Types.Mixed, default: null },
  updatedAt: { type: Date, default: Date.now },
});
lsVarSchema.index({ guildId: 1, scope: 1, ownerId: 1, key: 1 }, { unique: true });

module.exports = {
  LogicScriptModel: models.LogicScript  || model('LogicScript',  logicScriptSchema),
  LogicRunLogModel: models.LogicRunLog  || model('LogicRunLog',  logicRunLogSchema),
  LSVariable:       models.LogicScriptVar || model('LogicScriptVar', lsVarSchema),
};
