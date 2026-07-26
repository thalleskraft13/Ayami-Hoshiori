'use strict';

const { Schema, model, models } = require('mongoose');

const entradaSchema = new Schema({
  itemId:   { type: String, required: true },
  obtidoEm: { type: Number, default: Date.now }
}, { _id: false });

const collectionSchema = new Schema({
  userId: { type: String, required: true, unique: true },

  // Estrutura livre: cada categoria (recursos, itens, receitas, regioes,
  // companheiros, criacoes, e outras futuras) guarda a lista de itemIds já
  // obtidos ao menos uma vez, sem duplicar. Permite novas categorias sem
  // migração de schema.
  categorias: {
    type: Map,
    of: [entradaSchema],
    default: {}
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = models.Collection || model('Collection', collectionSchema);
