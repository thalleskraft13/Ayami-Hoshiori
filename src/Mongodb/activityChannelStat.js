'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const activityChannelStatSchema = new Schema({
  guildId:   { type: String, required: true },
  channelId: { type: String, required: true },

  totalMessages: { type: Number, default: 0 },

  firstMessageAt: { type: Date, default: null },
  lastMessageAt:  { type: Date, default: null },
}, {
  collection: 'activity_channel_stats',
  timestamps: { createdAt: false, updatedAt: true }
});

activityChannelStatSchema.index({ guildId: 1, channelId: 1 }, { unique: true });
activityChannelStatSchema.index({ guildId: 1, totalMessages: -1 });
activityChannelStatSchema.index({ guildId: 1, lastMessageAt: 1 });

module.exports = mongoose.models.ActivityChannelStat
  || mongoose.model('ActivityChannelStat', activityChannelStatSchema);
