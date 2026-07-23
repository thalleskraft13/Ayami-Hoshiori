'use strict';

const mongoose = require('mongoose');

const AuthorizationSchema = new mongoose.Schema({

  ownerGuildId: { type: String, required: true },

  requesterGuildId: { type: String, required: true },

  ownerId: { type: String, default: null },

  approvedBy: { type: String, default: null },

  sentVia: { type: String, default: null },

  permissionLevel: {
    type: String,
    enum: ['basic', 'advanced', 'multi_giveaway'],
    default: 'basic',
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'revoked'],
    default: 'pending',
  },

  authMessageId:  { type: String, default: null },
  authChannelId:  { type: String, default: null },

  expiresAt: { type: Date, default: null },

  requestedAt: { type: Date, default: Date.now },
  resolvedAt:  { type: Date, default: null },

}, {
  timestamps: true,
  collection: 'giveaway_authorizations',
});

AuthorizationSchema.index({ ownerGuildId: 1, requesterGuildId: 1 }, { unique: true });
AuthorizationSchema.index({ status: 1 });

module.exports = mongoose.models.GiveawayAuthorization
  || mongoose.model('GiveawayAuthorization', AuthorizationSchema);
