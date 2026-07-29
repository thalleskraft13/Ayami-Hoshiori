'use strict';

const { Schema, model } = require("mongoose");

const bankAccountSchema = new Schema({
  guildId:    { type: String, required: true, index: true },
  userId:     { type: String, required: true, index: true },
  saldoLocal: { type: Number, default: 0 },
  criadoEm:   { type: Number, default: Date.now }
}, {
  collection: 'server_bank_accounts'
});

bankAccountSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('ServerBankAccount', bankAccountSchema);
