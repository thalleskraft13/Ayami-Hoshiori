'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const houseActivitySchema = new Schema({
  guildId:         { type: String, required: true, index: true },
  userId:          { type: String, required: true, index: true },
  lastActivityAt:  { type: Date, default: null },
  presenceCount:   { type: Number, default: 0 },
  absenceCount:    { type: Number, default: 0 },
}, {
  collection: 'house_activity',
});

houseActivitySchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.HouseActivity || mongoose.model('HouseActivity', houseActivitySchema);
