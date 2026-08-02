'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const announceSchema = new Schema({
  channelId:      { type: String,  default: null },
  roleId:         { type: String,  default: null },
  enabled:        { type: Boolean, default: true },
  offlineEnabled: { type: Boolean, default: true },
  liveMessage:    { type: String,  default: null },
  offlineMessage: { type: String,  default: null },

  // Espelha o campo adicionado em site/models/twitchChannel.js (Fase
  // Dashboard — Aparência dos anúncios). Apenas declaração de schema:
  // o comportamento de envio em TwitchMonitorService#_sendAnnounce
  // NÃO foi alterado por esta adição.
  showExtraInfo: { type: Boolean, default: true },
  format:        { type: String,  enum: ['rich', 'simple'], default: 'rich' },
}, { _id: false });

const stateSchema = new Schema({
  isLive:           { type: Boolean, default: false },
  streamId:         { type: String,  default: null },
  startedAt:        { type: Date,    default: null },
  title:            { type: String,  default: '' },
  category:         { type: String,  default: '' },
  lastCheckedAt:    { type: Date,    default: null },
  currentHistoryId: { type: Schema.Types.ObjectId, default: null },
}, { _id: false });

// Checkpoint anti-duplicidade do polling de Follow (Alertas) — nunca
// mantido só em memória, precisa sobreviver a reinício do Bot. Só o
// tipo Follow usa isto hoje (Sub/Resub/GiftSub/Bits/Raid disparam
// direto pelos eventos do tmi.js, sem necessidade de checkpoint).
const alertsStateSchema = new Schema({
  lastFollowedAt: { type: Date,   default: null },
  lastFollowerId: { type: String, default: null },
}, { _id: false });

const twitchChannelSchema = new Schema({
  guildId:      { type: String, required: true, unique: true },

  twitchId:     { type: String, default: null },
  twitchLogin:  { type: String, default: null },
  displayName:  { type: String, default: null },
  profileImage: { type: String, default: null },

  connectedBy:  { type: String, default: null },
  connectedAt:  { type: Date,   default: null },

  moduleEnabled: { type: Boolean, default: true },

  announce: { type: announceSchema, default: () => ({}) },
  state:    { type: stateSchema,    default: () => ({}) },
  alertsState: { type: alertsStateSchema, default: () => ({}) },
}, { timestamps: true, collection: 'twitch_channels' });

module.exports = mongoose.models.TwitchChannel || mongoose.model('TwitchChannel', twitchChannelSchema);
