'use strict';

const { Schema, model, models } = require("mongoose");

const localMarketListingSchema = new Schema({
  guildId:       { type: String, required: true, index: true },
  sellerId:      { type: String, required: true, index: true },
  itemNome:      { type: String, required: true },
  quantidade:    { type: Number, required: true, min: 0 },
  precoUnitario: { type: Number, required: true, min: 1 },
  ativo:         { type: Boolean, default: true, index: true },
  criadoEm:      { type: Number, default: Date.now }
}, {
  collection: 'server_local_market_listings'
});

module.exports = models.ServerLocalMarketListing || model('ServerLocalMarketListing', localMarketListingSchema);
