'use strict';


const { Schema, model } = require('mongoose');

const guildMissionSchema = new Schema({
  guildId: { type: String, required: true, unique: true },

  missions: {
    weekly: {
      generatedAt: { type: Number, default: 0 },
      expiresAt:   { type: Number, default: 0 },
      list:        { type: Array,  default: [] }
      // cada item: { id, label, type, goal, progress, reward, done, contributors: [] }
    },
    event: {
      active:      { type: Boolean, default: false },
      generatedAt: { type: Number,  default: 0 },
      expiresAt:   { type: Number,  default: 0 },
      mission:     { type: Object,  default: null }
    }
  },

  pendingRewards: {
    type: [{ userId: String, amount: Number, label: String, date: Number }],
    default: []
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = model('GuildMission', guildMissionSchema);
