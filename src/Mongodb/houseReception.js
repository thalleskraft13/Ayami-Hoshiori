'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const houseReceptionSchema = new Schema({
  guildId:      { type: String, required: true, index: true },
  userId:       { type: String, required: true, index: true },
  currentIndex: { type: Number, default: 0 },
  answers:      { type: Schema.Types.Mixed, default: () => ({}) },
  status:       { type: String, enum: ['em_andamento', 'concluido', 'cancelado'], default: 'em_andamento' },
  startedAt:    { type: Date, default: Date.now },
  finishedAt:   { type: Date, default: null },
}, {
  collection: 'house_receptions',
});

houseReceptionSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.HouseReception || mongoose.model('HouseReception', houseReceptionSchema);
