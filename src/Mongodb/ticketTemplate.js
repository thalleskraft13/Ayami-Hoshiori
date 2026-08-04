'use strict';

const { Schema, model } = require('mongoose');

const ticketTemplateSchema = new Schema({
  libId:        { type: String, required: true, unique: true },
  authorId:     { type: String, required: true },
  authorName:   { type: String, default: '' },
  originGuildId:{ type: String, required: true },

  name:         { type: String, required: true },
  shortDesc:    { type: String, default: '', maxlength: 150 },
  fullDesc:     { type: String, default: '', maxlength: 2000 },

  tags:    { type: [String], default: [] },
  version: { type: String, default: '1.0.0' },

  config: { type: Schema.Types.Mixed, required: true },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },

  stats: {
    installs:    { type: Number, default: 0 },
    likes:       { type: Number, default: 0 },
    dislikes:    { type: Number, default: 0 },
    avgRating:   { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    weeklyScore: { type: Number, default: 0 }
  },

  publishedAt: { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

ticketTemplateSchema.index({ 'stats.installs': -1 });
ticketTemplateSchema.index({ 'stats.avgRating': -1 });
ticketTemplateSchema.index({ tags: 1, status: 1 });

const ticketTemplateRatingSchema = new Schema({
  libId:  { type: String, required: true },
  userId: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, default: null },
  vote:   { type: String, enum: ['like', 'dislike'], default: null }
});
ticketTemplateRatingSchema.index({ libId: 1, userId: 1 }, { unique: true });

const ticketTemplateInstallSchema = new Schema({
  libId:       { type: String, required: true },
  guildId:     { type: String, required: true },
  panelId:     { type: String, required: true },
  installedBy: { type: String, required: true },
  version:     { type: String, default: '1.0.0' },
  installedAt: { type: Date, default: Date.now }
});
ticketTemplateInstallSchema.index({ libId: 1, guildId: 1 });

module.exports = {
  TicketTemplateModel:        model('TicketTemplate',        ticketTemplateSchema),
  TicketTemplateRatingModel:  model('TicketTemplateRating',  ticketTemplateRatingSchema),
  TicketTemplateInstallModel: model('TicketTemplateInstall', ticketTemplateInstallSchema),
};
