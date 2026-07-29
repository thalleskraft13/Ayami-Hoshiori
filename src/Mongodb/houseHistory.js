'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const houseHistorySchema = new Schema({
  guildId:    { type: String, required: true, index: true },
  action:     { type: String, required: true },
  userId:     { type: String, default: null },
  staffId:    { type: String, default: null },
  detail:     { type: String, default: null },
  result:     { type: String, enum: ['sucesso', 'falha'], default: 'sucesso' },
  at:         { type: Date, default: Date.now },
}, {
  collection: 'house_history',
});

module.exports = mongoose.models.HouseHistory || mongoose.model('HouseHistory', houseHistorySchema);
