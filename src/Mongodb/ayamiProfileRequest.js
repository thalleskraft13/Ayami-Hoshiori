'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ayamiProfileRequestSchema = new Schema({
  guildId:   { type: String, required: true, index: true },
  guildName: { type: String, default: null },
  guildIcon: { type: String, default: null },

  ownerId:   { type: String, default: null },
  ownerName: { type: String, default: null },

  requesterId:   { type: String, required: true },
  requesterName: { type: String, default: null },

  changes: {
    avatar: {
      requested: { type: Boolean, default: false },
      url:       { type: String, default: null },
      previousUrl: { type: String, default: null },
    },
    banner: {
      requested: { type: Boolean, default: false },
      url:       { type: String, default: null },
      previousUrl: { type: String, default: null },
    },
    bio: {
      requested: { type: Boolean, default: false },
      text:       { type: String, default: null },
      previousText: { type: String, default: null },
    },
  },

  reason: { type: String, default: null },

  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
    index: true,
  },

  reviewChannelId: { type: String, default: '1527960368251670628' },
  reviewMessageId: { type: String, default: null },

  notifyChannelId: { type: String, default: null },

  resolvedBy:     { type: String, default: null },
  denialReason:   { type: String, default: null },
  appliedChanges: {
    avatar: { type: Boolean, default: false },
    banner: { type: Boolean, default: false },
    bio:    { type: Boolean, default: false },
  },

  resolvedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'ayami_profile_requests',
});

ayamiProfileRequestSchema.index({ guildId: 1, status: 1 });
ayamiProfileRequestSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.models.AyamiProfileRequest
  || mongoose.model('AyamiProfileRequest', ayamiProfileRequestSchema);
