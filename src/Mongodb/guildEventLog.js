'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const guildEventLogSchema = new Schema({
  guildId:     { type: String, required: true, index: true },
  guildName:   { type: String, default: null },
  ownerId:     { type: String, default: null },
  memberCount: { type: Number, default: 0 },
  event:       { type: String, enum: ['join', 'leave'], required: true },
  at:          { type: Date, default: Date.now },
}, {
  collection: 'guild_event_logs',
});

module.exports = mongoose.models.GuildEventLog || mongoose.model('GuildEventLog', guildEventLogSchema);
