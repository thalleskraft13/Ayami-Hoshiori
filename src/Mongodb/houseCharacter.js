'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const houseCharacterSchema = new Schema({
  guildId:            { type: String, required: true, index: true },
  name:               { type: String, required: true },
  description:        { type: String, default: null },
  image:               { type: String, default: null },
  roleId:              { type: String, default: null },
  factionRoleId:       { type: String, default: null },
  slots:               { type: Number, default: 1 },
  occupiedSlots:       { type: Number, default: 0 },
  available:           { type: Boolean, default: true },
  allowedDecorations:  { type: [String], default: [] },
  currentUserId:       { type: String, default: null },
  chosenAt:            { type: Date, default: null },
  approvedBy:          { type: String, default: null },
  createdAt:           { type: Date, default: Date.now },
  updatedAt:           { type: Date, default: Date.now },
}, {
  collection: 'house_characters',
});

houseCharacterSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.models.HouseCharacter || mongoose.model('HouseCharacter', houseCharacterSchema);
