'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const liveWindowSchema = new Schema({
  days: { type: [Number], default: undefined },
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { _id: false });

const streamerSchema = new Schema({
  id: { type: String, required: true, unique: true },
  youtube: { type: String, default: '' },
  twitch: { type: String, default: '' },
  instagram: { type: String, default: '' },
  tiktok: { type: String, default: '' },
  discord: { type: String, default: '' },

  uploadSchedule: { type: [String], default: undefined },
  liveSchedule: { type: [liveWindowSchema], default: undefined },

  tags: { type: [String], default: [] },
  description: { type: String, default: '' },
  oficial: { type: Boolean, default: false },

  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.Streamer || mongoose.model('Streamer', streamerSchema);
