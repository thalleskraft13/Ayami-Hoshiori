'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const announceSchema = new Schema({
  channelId:     { type: String,  default: null },
  roleId:        { type: String,  default: null },

  videosEnabled: { type: Boolean, default: true },
  shortsEnabled: { type: Boolean, default: true },
  livesEnabled:  { type: Boolean, default: true },

  videoMessage: { type: String, default: null },
  shortMessage: { type: String, default: null },
  liveMessage:  { type: String, default: null },
}, { _id: false });

const stateSchema = new Schema({
  knownVideoIds:  { type: [String], default: [] },
  lastLiveVideoId: { type: String,  default: null },
  isLive:          { type: Boolean, default: false },
  lastCheckedAt:   { type: Date,    default: null },
}, { _id: false });

const youtubeChannelSchema = new Schema({
  guildId: { type: String, required: true, unique: true },

  youtubeChannelId:  { type: String, default: null },
  handle:             { type: String, default: null },
  title:               { type: String, default: null },
  thumbnailUrl:        { type: String, default: null },
  uploadsPlaylistId:   { type: String, default: null },

  connectedBy: { type: String, default: null },
  connectedAt: { type: Date,   default: null },

  moduleEnabled: { type: Boolean, default: true },

  announce: { type: announceSchema, default: () => ({}) },
  state:    { type: stateSchema,    default: () => ({}) },
}, { timestamps: true, collection: 'youtube_channels' });

module.exports = mongoose.models.YoutubeChannel || mongoose.model('YoutubeChannel', youtubeChannelSchema);
