'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const blacklistSchema = new Schema({
  userId:    { type: String, required: true, unique: true, index: true },
  staffId:   { type: String, required: true }, // quem aplicou o ban
  motivo:    { type: String, default: "Não especificado" },
  appliedAt: { type: Number, default: () => Date.now() },
}, {
  collection: 'blacklist',
});

module.exports = mongoose.models.Blacklist || mongoose.model('Blacklist', blacklistSchema);
