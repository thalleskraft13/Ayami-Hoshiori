'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const houseCallSchema = new Schema({
  guildId:      { type: String, required: true, index: true },
  startedBy:    { type: String, required: true },
  channelId:    { type: String, default: null },
  presentUserIds: { type: [String], default: [] },
  absentUserIds:  { type: [String], default: [] },
  status:       { type: String, enum: ['aberta', 'encerrada'], default: 'aberta' },
  startedAt:    { type: Date, default: Date.now },
  endedAt:      { type: Date, default: null },
  closesAt:     { type: Date, default: null }, // calculado no start: startedAt + duration, se configurado
  autoClosed:   { type: Boolean, default: false }, // true se fechou por timeout
}, {
  collection: 'house_calls',
});

module.exports = mongoose.models.HouseCall || mongoose.model('HouseCall', houseCallSchema);
