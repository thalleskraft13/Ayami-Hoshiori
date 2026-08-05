'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const PERMISSIONS = Object.freeze({
  EVERYONE:   'everyone',
  SUBSCRIBER: 'subscriber',
  VIP:        'vip',
  MODERATOR:  'moderator',
  BROADCASTER: 'broadcaster',
});

const twitchCommandSchema = new Schema({
  guildId:  { type: String, required: true, index: true },
  platform: { type: String, required: true, default: 'twitch', index: true },

  
  
  trigger: { type: String, required: true, trim: true, lowercase: true },

  
  response: { type: String, required: true },

  cooldownSeconds: { type: Number, default: 10, min: 0 },
  permission: {
    type: String,
    enum: Object.values(PERMISSIONS),
    default: PERMISSIONS.EVERYONE,
  },

  active: { type: Boolean, default: true },

  usageCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: null },
  lastUsedBy: { type: String, default: null }, 

  createdBy: { type: String, default: null }, 
}, {
  timestamps: true,
  collection: 'twitch_chat_commands',
});

twitchCommandSchema.index({ guildId: 1, platform: 1, trigger: 1 }, { unique: true });

module.exports = mongoose.models.TwitchCommand
  || mongoose.model('TwitchCommand', twitchCommandSchema);

module.exports.PERMISSIONS = PERMISSIONS;
