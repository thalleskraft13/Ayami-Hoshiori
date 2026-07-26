'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const itemQtd = {
  itemId:     { type: String, required: true },
  quantidade: { type: Number, required: true, min: 1 },
};

const tradeSchema = new Schema({
  proponenteId:       { type: String, required: true, index: true },
  alvoId:             { type: String, required: true, index: true },
  itensProponente:    { type: [itemQtd], default: [] },
  itensAlvo:          { type: [itemQtd], default: [] },
  estrelasProponente: { type: Number, default: 0 },
  estrelasAlvo:       { type: Number, default: 0 },
  status:             { type: String, enum: ['pendente', 'aceito', 'recusado', 'cancelado'], default: 'pendente', index: true },
  criadoEm:           { type: Number, default: Date.now },
  resolvidoEm:        { type: Number, default: null },
}, {
  collection: 'trades',
});

module.exports = mongoose.models.Trade || mongoose.model('Trade', tradeSchema);
