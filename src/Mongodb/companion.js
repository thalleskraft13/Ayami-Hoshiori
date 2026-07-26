'use strict';

const { Schema, model, models } = require('mongoose');

const companionSchema = new Schema({
  userId:        { type: String, required: true, index: true },
  companheiroId: { type: String, required: true },
  nivel:         { type: Number, default: 1 },
  felicidade:    { type: Number, default: 50 },
  obtidoEm:      { type: Number, default: Date.now }
}, {
  collection: 'companions'
});

companionSchema.index({ userId: 1, companheiroId: 1 }, { unique: true });

module.exports = models.Companion || model('Companion', companionSchema);
