'use strict';

const { Schema, model, models } = require('mongoose');

const plotSchema = new Schema({
  index:       { type: Number, required: true },
  sementeId:   { type: String, default: null },
  plantadoEm:  { type: Number, default: null },
  prontoEm:    { type: Number, default: null }
}, { _id: false });

const DEFAULT_PLOTS = 4;

function buildDefaultPlots(length = DEFAULT_PLOTS) {
  return Array.from({ length }, (_, i) => ({
    index: i,
    sementeId: null,
    plantadoEm: null,
    prontoEm: null
  }));
}

const gardenSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },

  plots: {
    type: [plotSchema],
    default: () => buildDefaultPlots()
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

const GardenModel = models.Garden || model('Garden', gardenSchema);

GardenModel.DEFAULT_PLOTS = DEFAULT_PLOTS;
GardenModel.buildDefaultPlots = buildDefaultPlots;

module.exports = GardenModel;
