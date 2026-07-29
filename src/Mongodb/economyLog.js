'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const economyLogSchema = new Schema({
  userId:           { type: String, required: true, index: true },
  action:           { type: String, required: true },
  previousBalance:  { type: Number, required: true },
  amount:           { type: Number, required: true },
  currentBalance:   { type: Number, required: true },
  difference:       { type: Number, required: true },

  origin:           { type: String, default: null },
  destination:      { type: String, default: null },

  actorId:          { type: String, default: null },
  guildId:          { type: String, default: null },
  guildName:        { type: String, default: null },

  metadata:         { type: Schema.Types.Mixed, default: null },

  createdAt:        { type: Date, default: Date.now },
}, {
  collection: 'economy_logs',
});

module.exports = mongoose.models.EconomyLog || mongoose.model('EconomyLog', economyLogSchema);
