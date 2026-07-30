'use strict';

const { Schema, model } = require("mongoose");

const bankLedgerSchema = new Schema({
  guildId:        { type: String, required: true, index: true },
  tipo:           { type: String, required: true },
  operacao:       { type: String, required: true },

  userId:         { type: String, default: null },
  alvoId:         { type: String, default: null },

  quantidade:     { type: Number, default: 0 },
  saldoAnterior:  { type: Number, default: null },
  saldoAtual:     { type: Number, default: null },

  sucesso:        { type: Boolean, default: true },
  motivoFalha:    { type: String, default: null },

  metadata:       { type: Schema.Types.Mixed, default: null },
  criadoEm:       { type: Number, default: Date.now }
}, {
  collection: 'server_bank_ledger'
});

module.exports = model('ServerBankLedger', bankLedgerSchema);
