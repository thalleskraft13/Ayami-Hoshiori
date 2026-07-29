'use strict';

const { Schema, model, models } = require('mongoose');

const logicEndpointSchema = new Schema({
  guildId:       { type: String, required: true, index: true },
  logicScriptId: { type: String, required: true },

  enabled: { type: Boolean, default: false },

  secretHash:      { type: String, default: null },
  secretCreatedAt: { type: Date,   default: null },
  secretCreatedBy: { type: String, default: null },

  ipWhitelist: { type: [String], default: [] },

  requestCount:  { type: Number, default: 0 },
  lastRequestAt: { type: Date,   default: null },
  lastStatus:    { type: Number, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
logicEndpointSchema.index({ guildId: 1, logicScriptId: 1 }, { unique: true });

const logicEndpointRequestSchema = new Schema({
  guildId:       { type: String, required: true, index: true },
  logicScriptId: { type: String, required: true, index: true },

  method:    { type: String, default: 'POST' },
  headers:   { type: Schema.Types.Mixed, default: {} },
  query:     { type: Schema.Types.Mixed, default: {} },
  body:      { type: Schema.Types.Mixed, default: {} },
  ip:        { type: String, default: null },
  userAgent: { type: String, default: null },

  status: {
    type: String,
    enum: ['pending', 'processing', 'done', 'error'],
    default: 'pending',
    index: true,
  },

  claimedBy: { type: String, default: null },

  responseStatus:  { type: Number, default: 200 },
  responseHeaders: { type: Schema.Types.Mixed, default: {} },
  responseBody:    { type: Schema.Types.Mixed, default: null },
  error:           { type: String, default: null },

  createdAt:   { type: Date, default: Date.now, expires: 60 * 5 },
  processedAt: { type: Date, default: null },
});
logicEndpointRequestSchema.index({ status: 1, createdAt: 1 });

const logicEndpointLogSchema = new Schema({
  guildId:       { type: String, required: true, index: true },
  logicScriptId: { type: String, required: true, index: true },

  method:      { type: String, default: 'POST' },
  statusCode:  { type: Number, default: null },
  ip:          { type: String, default: null },
  durationMs:  { type: Number, default: 0 },
  error:       { type: String, default: null },
  logs:        { type: [String], default: [] },

  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});
logicEndpointLogSchema.index({ guildId: 1, logicScriptId: 1, createdAt: -1 });

module.exports = {
  LogicEndpointModel:        models.LogicEndpoint        || model('LogicEndpoint',        logicEndpointSchema),
  LogicEndpointRequestModel: models.LogicEndpointRequest  || model('LogicEndpointRequest', logicEndpointRequestSchema),
  LogicEndpointLogModel:     models.LogicEndpointLog      || model('LogicEndpointLog',     logicEndpointLogSchema),
};
