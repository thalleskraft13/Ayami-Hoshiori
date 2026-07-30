'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const twitchHistorySchema = new Schema({
  guildId:  { type: String, required: true },
  twitchId: { type: String, required: true },
  streamId: { type: String, default: null },

  title:    { type: String, default: '' },
  category: { type: String, default: '' },

  startedAt:       { type: Date,   required: true },
  endedAt:         { type: Date,   default: null },
  durationSeconds: { type: Number, default: null },
}, { timestamps: true, collection: 'twitch_history' });

twitchHistorySchema.index({ guildId: 1, startedAt: -1 });

module.exports = mongoose.models.TwitchHistory || mongoose.model('TwitchHistory', twitchHistorySchema);
