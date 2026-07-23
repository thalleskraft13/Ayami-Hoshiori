'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const activityDailyStatSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  date:    { type: String, required: true }, // 'YYYY-MM-DD' (UTC)

  messageCount: { type: Number, default: 0 },

  messagesByHour: {
    type: [Number],
    default: () => Array(24).fill(0)
  },

  newMembers:  { type: Number, default: 0 }, // entradas no servidor nesse dia
  leftMembers: { type: Number, default: 0 }, // saídas do servidor nesse dia

  memberCountEnd: { type: Number, default: null },

}, {
  collection: 'activity_daily_stats',
  timestamps: { createdAt: true, updatedAt: true }
});

activityDailyStatSchema.index({ guildId: 1, date: 1 }, { unique: true });

module.exports = mongoose.models.ActivityDailyStat
  || mongoose.model('ActivityDailyStat', activityDailyStatSchema);
