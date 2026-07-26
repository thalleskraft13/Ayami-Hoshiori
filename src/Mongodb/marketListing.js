'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const marketListingSchema = new Schema({
  sellerId:      { type: String, required: true, index: true },
  itemId:        { type: String, required: true, index: true },
  quantidade:    { type: Number, required: true, min: 0 },
  precoUnitario: { type: Number, required: true, min: 1 },
  ativo:         { type: Boolean, default: true, index: true },
  criadoEm:      { type: Number, default: Date.now },
}, {
  collection: 'market_listings',
});

module.exports = mongoose.models.MarketListing || mongoose.model('MarketListing', marketListingSchema);
