'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const auctionSchema = new Schema({
  sellerId:        { type: String, required: true, index: true },
  itemId:          { type: String, required: true },
  quantidade:      { type: Number, required: true, min: 1 },
  lanceMinimo:     { type: Number, required: true, min: 1 },
  lanceAtual:      { type: Number, default: 0 },
  licitanteAtualId: { type: String, default: null },
  terminaEm:       { type: Number, required: true },
  finalizado:      { type: Boolean, default: false, index: true },
  cancelado:       { type: Boolean, default: false },
  criadoEm:        { type: Number, default: Date.now },
}, {
  collection: 'auctions',
});

module.exports = mongoose.models.Auction || mongoose.model('Auction', auctionSchema);
