'use strict';

const { Schema, model, models } = require("mongoose");

const itemEntreguevelSchema = new Schema({
  nome:       { type: String, required: true },
  quantidade: { type: Number, default: 1 }
}, { _id: false });

const shopProductSchema = new Schema({
  guildId:          { type: String, required: true, index: true },
  categoriaId:      { type: String, required: true, index: true },

  nome:             { type: String, required: true },
  descricao:        { type: String, default: '' },
  imagem:           { type: String, default: null },

  preco:            { type: Number, required: true, min: 0 },
  estoque:          { type: Number, default: null },

  cargosEntregues:  { type: [String], default: [] },
  itensEntregues:   { type: [itemEntreguevelSchema], default: [] },

  ordem:            { type: Number, default: 0 },
  ativo:            { type: Boolean, default: true },
  criadoEm:         { type: Number, default: Date.now }
}, {
  collection: 'server_shop_products'
});

module.exports = models.ServerShopProduct || model('ServerShopProduct', shopProductSchema);
