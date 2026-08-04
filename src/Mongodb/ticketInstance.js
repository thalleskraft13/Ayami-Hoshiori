'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const claimHistoryEntrySchema = new Schema({
  action:         { type: String, enum: ['claim', 'unclaim', 'transfer'], required: true },
  byUserId:       { type: String, required: true },
  previousUserId: { type: String, default: null },
  newUserId:      { type: String, default: null },
  at:             { type: Date, default: Date.now }
}, { _id: false });

const participantHistoryEntrySchema = new Schema({
  action:       { type: String, enum: ['add', 'remove'], required: true },
  byUserId:     { type: String, required: true },
  targetUserId: { type: String, required: true },
  at:           { type: Date, default: Date.now }
}, { _id: false });

const ticketInstanceSchema = new Schema({
  guildId:            { type: String, required: true },
  channelId:           { type: String, required: true, unique: true },
  panelId:             { type: String, required: true },
  ownerId:             { type: String, required: true },
  status:              { type: String, enum: ['open', 'closed'], default: 'open' },

  claimedBy:           { type: String, default: null },
  claimHistory:        { type: [claimHistoryEntrySchema], default: [] },

  participants:        { type: [String], default: [] },
  participantHistory:  { type: [participantHistoryEntrySchema], default: [] },

  statusMessageId:     { type: String, default: null },

  createdAt:           { type: Date, default: Date.now },
  closedAt:            { type: Date, default: null },
  closedBy:            { type: String, default: null }
}, {
  collection: 'ticketinstances'
});

module.exports = mongoose.models.TicketInstance || mongoose.model('TicketInstance', ticketInstanceSchema);
