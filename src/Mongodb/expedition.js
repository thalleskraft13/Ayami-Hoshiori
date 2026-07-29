'use strict';

const { Schema, model, models } = require('mongoose');

const expeditionSchema = new Schema({
  userId:      { type: String, required: true, index: true },
  regiaoId:    { type: String, required: true },
  duracao:     { type: String, required: true },
  companheiroId: { type: String, default: null },
  iniciadoEm:  { type: Number, required: true },
  finalizaEm:  { type: Number, required: true },
  coletado:    { type: Boolean, default: false }
}, {
  collection: 'expeditions'
});

module.exports = models.Expedition || model('Expedition', expeditionSchema);
