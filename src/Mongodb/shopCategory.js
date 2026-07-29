'use strict';

const { Schema, model, models } = require("mongoose");

const shopCategorySchema = new Schema({
  guildId:  { type: String, required: true, index: true },
  nome:     { type: String, required: true },
  ordem:    { type: Number, default: 0 },
  criadoEm: { type: Number, default: Date.now }
}, {
  collection: 'server_shop_categories'
});

module.exports = models.ServerShopCategory || model('ServerShopCategory', shopCategorySchema);
