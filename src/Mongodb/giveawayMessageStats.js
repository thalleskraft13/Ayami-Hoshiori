'use strict';

const mongoose = require('mongoose');

const MessageStatsSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  guildId:   { type: String, required: true },
  count:     { type: Number, default: 0 },
  updatedAt: { type: Date,   default: Date.now },
}, {
  collection: 'giveaway_message_stats',
});

MessageStatsSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.models.GiveawayMessageStats
  || mongoose.model('GiveawayMessageStats', MessageStatsSchema);
