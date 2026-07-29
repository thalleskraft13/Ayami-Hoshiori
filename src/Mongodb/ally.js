'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const allySchema = new Schema({
  id: { type: String, required: true, unique: true },
  bot: { type: Boolean, default: false },
  tags: { type: [String], default: [] },
  description: { type: String, default: '' },
  oficial: { type: Boolean, default: false },

  invite: { type: String, default: null },

  botInviteUrl: { type: String, default: null },
  supportServerUrl: { type: String, default: null },

  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.Ally || mongoose.model('Ally', allySchema);
