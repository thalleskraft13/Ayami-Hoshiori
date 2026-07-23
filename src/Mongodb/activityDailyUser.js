'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const activityDailyUserSchema = new Schema({
  guildId: { type: String, required: true },
  date:    { type: String, required: true }, // 'YYYY-MM-DD' (UTC)
  userId:  { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 400 },
}, {
  collection: 'activity_daily_users',
});

activityDailyUserSchema.index({ guildId: 1, date: 1, userId: 1 }, { unique: true });
activityDailyUserSchema.index({ guildId: 1, date: 1 });

module.exports = mongoose.models.ActivityDailyUser
  || mongoose.model('ActivityDailyUser', activityDailyUserSchema);
