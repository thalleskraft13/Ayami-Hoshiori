'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const youtubeHistorySchema = new Schema({
  guildId:          { type: String, required: true },
  youtubeChannelId: { type: String, required: true },
  videoId:          { type: String, required: true },

  type: { type: String, enum: ['video', 'short', 'live'], required: true },

  title:       { type: String, default: '' },
  link:        { type: String, default: '' },
  publishedAt: { type: Date,   required: true },
}, { timestamps: true, collection: 'youtube_history' });

youtubeHistorySchema.index({ guildId: 1, publishedAt: -1 });
youtubeHistorySchema.index({ guildId: 1, videoId: 1 }, { unique: true });

module.exports = mongoose.models.YoutubeHistory || mongoose.model('YoutubeHistory', youtubeHistorySchema);
