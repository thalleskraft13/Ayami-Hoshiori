'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const presenceSchema = new Schema({
  name:   { type: String, default: null },
  type:   { type: Number, default: 0 },
  status: { type: String, default: 'online' },
  url:    { type: String, default: null },
  state:  { type: String, default: null },
}, { _id: false });

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
