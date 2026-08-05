'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const PLATFORMS = Object.freeze(['twitch', 'youtube', 'tiktok', 'kick']);

const STATUSES = Object.freeze({
  CONNECTED: 'connected', 
  ERROR: 'error', 
  EXPIRED: 'expired', 
  DISCONNECTED: 'disconnected', 
});

const oauthSchema = new Schema({
  accessToken: { type: String, default: null },
  refreshToken: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  scopes: { type: [String], default: [] },
}, { _id: false });

const statsSchema = new Schema({
  livesAcompanhadas: { type: Number, default: 0 },
  horasAssistidas: { type: Number, default: 0 },
  streakAtual: { type: Number, default: 0 },
  maiorStreak: { type: Number, default: 0 },
  ultimaAtividadeEm: { type: Date, default: null },
  missoesConcluidas: { type: Number, default: 0 },
  recompensasRecebidas: { type: Number, default: 0 },
}, { _id: false });

const creatorAccountLinkSchema = new Schema({
  
  discordUserId: { type: String, required: true },
  platform: { type: String, required: true, enum: PLATFORMS },
  platformUserId: { type: String, required: true },

  
  
  platformLogin: { type: String, default: null },
  displayName: { type: String, default: null },
  avatarUrl: { type: String, default: null },

  
  
  
  oauth: { type: oauthSchema, default: () => ({}) },

  status: { type: String, enum: Object.values(STATUSES), default: STATUSES.CONNECTED },
  lastError: { type: String, default: null },

  linkedAt: { type: Date, default: Date.now },
  unlinkedAt: { type: Date, default: null },
  lastSyncedAt: { type: Date, default: null },

  
  
  stats: { type: statsSchema, default: () => ({}) },
}, {
  timestamps: true,
  collection: 'creator_account_links',
});

creatorAccountLinkSchema.index(
  { platform: 1, platformUserId: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: STATUSES.DISCONNECTED } } },
);

creatorAccountLinkSchema.index(
  { platform: 1, discordUserId: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: STATUSES.DISCONNECTED } } },
);

creatorAccountLinkSchema.index({ discordUserId: 1 });

module.exports = mongoose.models.CreatorAccountLink
  || mongoose.model('CreatorAccountLink', creatorAccountLinkSchema);

module.exports.PLATFORMS = PLATFORMS;
module.exports.STATUSES = STATUSES;
