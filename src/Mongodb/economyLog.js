'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const economyLogSchema = new Schema({
  userId:           { type: String, required: true, index: true },
  action:           { type: String, required: true }, // add | remove | reset | banner_pull
  previousBalance:  { type: Number, required: true },
  amount:            { type: Number, required: true },
  currentBalance:   { type: Number, required: true },
  difference:       { type: Number, required: true },
  characters:       { type: [{ item: String, tipo: Number, novo: Boolean, constelacao: Number }], default: undefined },
  bannerId:         { type: Schema.Types.Mixed, default: null },
  createdAt:        { type: Date, default: Date.now },
}, {
  collection: 'economy_logs',
});

module.exports = mongoose.models.EconomyLog || mongoose.model('EconomyLog', economyLogSchema);
