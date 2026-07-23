'use strict';


const { Schema, model } = require('mongoose');

const adventureGroupSchema = new Schema({
  groupId: { type: String, required: true, unique: true },

  leaderId: { type: String, required: true },

  members: {
    type: [String],
    default: [],
    validate: { validator: v => v.length <= 4, message: 'Grupo cheio (máx 4 membros).' }
  },

  pendingInvites: {
    type: [{ userId: String, expiresAt: Number }],
    default: []
  },

  missions: {
    daily: {
      generatedAt: { type: Number, default: 0 },
      expiresAt:   { type: Number, default: 0 },
      list:        { type: Array,  default: [] }
    },
    weekly: {
      generatedAt: { type: Number, default: 0 },
      expiresAt:   { type: Number, default: 0 },
      list:        { type: Array,  default: [] }
    }
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = model('AdventureGroup', adventureGroupSchema);
