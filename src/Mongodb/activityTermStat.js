'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const activityTermStatSchema = new Schema({
  guildId: { type: String, required: true },
  kind:    { type: String, enum: ['word', 'emoji', 'reaction'], required: true },
  term:    { type: String, required: true }, // palavra normalizada, ID/nome do emoji, ou nome da reação
  date:    { type: String, required: true }, // 'YYYY-MM-DD' (UTC)

  count: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 120 },
}, {
  collection: 'activity_term_stats',
});

activityTermStatSchema.index({ guildId: 1, kind: 1, term: 1, date: 1 }, { unique: true });
activityTermStatSchema.index({ guildId: 1, kind: 1, date: 1 });

module.exports = mongoose.models.ActivityTermStat
  || mongoose.model('ActivityTermStat', activityTermStatSchema);
