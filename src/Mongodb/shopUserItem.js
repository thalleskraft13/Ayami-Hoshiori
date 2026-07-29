'use strict';

const { Schema, model, models } = require("mongoose");

const shopUserItemSchema = new Schema({
  guildId:    { type: String, required: true, index: true },
  userId:     { type: String, required: true, index: true },
  itemNome:   { type: String, required: true },
  quantidade: { type: Number, default: 0 },
  criadoEm:   { type: Number, default: Date.now }
}, {
  collection: 'server_shop_user_items'
});

shopUserItemSchema.index({ guildId: 1, userId: 1, itemNome: 1 }, { unique: true });

module.exports = models.ServerShopUserItem || model('ServerShopUserItem', shopUserItemSchema);
