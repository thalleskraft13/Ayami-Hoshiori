'use strict';

const { Schema, model } = require('mongoose');

const libraryMessageSchema = new Schema({
  libId:        { type: String, required: true, unique: true },
  authorId:     { type: String, required: true },
  authorName:   { type: String, default: '' },

  name:         { type: String, required: true },
  shortDesc:    { type: String, default: '', maxlength: 150 },
  fullDesc:     { type: String, default: '', maxlength: 2000 },

  type: {
    type: String,
    enum: ['embed', 'components_v2'],
    required: true
  },

  category: {
    type: String,
    enum: [
      'Moderação','Economia','Automação','Logs','Tickets',
      'Recompensas','Eventos','RPG','Utilidade','Comunidade',
      'Diversão','Outros'
    ],
    default: 'Outros'
  },

  tags:    { type: [String], default: [] },
  version: { type: String, default: '1.0.0' },

  content:    { type: String, default: '' },
  embeds:     { type: [Schema.Types.Mixed], default: [] },
  components: { type: [Schema.Types.Mixed], default: [] },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },

  stats: {
    installs:     { type: Number, default: 0 },
    likes:        { type: Number, default: 0 },
    dislikes:     { type: Number, default: 0 },
    avgRating:    { type: Number, default: 0 },
    ratingCount:  { type: Number, default: 0 },
    weeklyScore:  { type: Number, default: 0 }
  },

  publishedAt: { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },

  lastChangelog: { type: String, default: '' },

  versionHistory: {
    type: [{
      version:    { type: String },
      changelog:  { type: String, default: '' },
      archivedAt: { type: Date }
    }],
    default: []
  }
});

libraryMessageSchema.index({ 'stats.installs': -1 });
libraryMessageSchema.index({ 'stats.avgRating': -1 });
libraryMessageSchema.index({ 'stats.weeklyScore': -1 });
libraryMessageSchema.index({ category: 1, status: 1 });
libraryMessageSchema.index({ tags: 1, status: 1 });
libraryMessageSchema.index({ type: 1, status: 1 });

const libraryMessageRatingSchema = new Schema({
  libId:   { type: String, required: true },
  userId:  { type: String, required: true },
  rating:  { type: Number, min: 1, max: 5, default: null },
  vote:    { type: String, enum: ['like', 'dislike'], default: null }
});
libraryMessageRatingSchema.index({ libId: 1, userId: 1 }, { unique: true });

const libraryMessageInstallSchema = new Schema({
  libId:          { type: String, required: true },
  guildId:        { type: String, required: true },
  installedBy:    { type: String, required: true },
  savedMessageId: { type: String, default: null },
  version:        { type: String, default: '1.0.0' },
  installedAt:    { type: Date, default: Date.now }
});
libraryMessageInstallSchema.index({ libId: 1, guildId: 1 });

module.exports = {
  LibraryMessageModel:        model('LibraryMessage',        libraryMessageSchema),
  LibraryMessageRatingModel:  model('LibraryMessageRating',  libraryMessageRatingSchema),
  LibraryMessageInstallModel: model('LibraryMessageInstall', libraryMessageInstallSchema),
};
