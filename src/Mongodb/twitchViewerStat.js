'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const twitchViewerStatSchema = new Schema({
  guildId:  { type: String, required: true, index: true },
  platform: { type: String, required: true, default: 'twitch', index: true },

  viewerTwitchId:    { type: String, required: true },
  viewerLogin:       { type: String, default: null }, 
  viewerDisplayName: { type: String, default: null },

  messageCount: { type: Number, default: 0 },
  watchSeconds: { type: Number, default: 0 },
  livesWatched: { type: Number, default: 0 },

  
  
  
  lastCountedStreamId: { type: String, default: null },

  lastSeenAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'twitch_viewer_stats',
});

twitchViewerStatSchema.index({ guildId: 1, platform: 1, viewerTwitchId: 1 }, { unique: true });

twitchViewerStatSchema.index({ guildId: 1, watchSeconds: -1 });

module.exports = mongoose.models.TwitchViewerStat
  || mongoose.model('TwitchViewerStat', twitchViewerStatSchema);
