'use strict';

const { Schema, model, models } = require('mongoose');

const plotSchema = new Schema({
  index:       { type: Number, required: true },
  sementeId:   { type: String, default: null },
  plantadoEm:  { type: Number, default: null },
  prontoEm:    { type: Number, default: null }
}, { _id: false });

const DEFAULT_PLOTS = 4;

const gardenSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },

  plots: {
    type: [plotSchema],
    default: () => Array.from({ length: DEFAULT_PLOTS }, (_, i) => ({
      index: i,
      sementeId: null,
      plantadoEm: null,
      prontoEm: null
    }))
  },

  construcoes: {
    type: [String],
    default: []
  },

  decoracoes: {
    type: [String],
    default: []
  }
}, {
  collection: 'gardens'
});

module.exports = models.Garden || model('Garden', gardenSchema);
