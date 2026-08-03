'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PLATFORMS } = require('./creatorAccountLink.js');

const MISSION_TYPES = Object.freeze({
  WATCH_STREAM:   'watch_stream',
  WATCH_DURATION: 'watch_duration',
  STREAK:         'streak',
  EVENT:          'event_participation',
  MESSAGE_COUNT:  'message_count',
  CUSTOM:         'custom',
});

const PERIODS = Object.freeze({
  ONCE:    'once',
  DAILY:   'daily',
  WEEKLY:  'weekly',
  MONTHLY: 'monthly',
});

const goalSchema = new Schema({
  target: { type: Number, default: 1 },
  unit:   { type: String, default: null },
}, { _id: false });

const rewardSchema = new Schema({
  type:         { type: String, default: null },
  description:  { type: String, default: null },
  roleId:       { type: String, default: null },
  logChannelId: { type: String, default: null },
}, { _id: false });

const creatorMissionSchema = new Schema({
  guildId:  { type: String, required: true },
  platform: { type: String, required: true, enum: PLATFORMS },

    key:  { type: String, required: true },
  type: { type: String, required: true, enum: Object.values(MISSION_TYPES) },

  title:       { type: String, required: true },
  description: { type: String, default: '' },

  goal:   { type: goalSchema, default: () => ({}) },
  period: { type: String, enum: Object.values(PERIODS), default: PERIODS.ONCE },

        requiredPlan: { type: String, default: 'FREE' },

  active:    { type: Boolean, default: true },
  createdBy: { type: String, default: null },

  reward: { type: rewardSchema, default: () => ({}) },
}, {
  timestamps: true,
  collection: 'creator_missions',
});

creatorMissionSchema.index({ guildId: 1, platform: 1, key: 1 }, { unique: true });
creatorMissionSchema.index({ guildId: 1, platform: 1, active: 1 });

module.exports = mongoose.models.CreatorMission
  || mongoose.model('CreatorMission', creatorMissionSchema);

module.exports.MISSION_TYPES = MISSION_TYPES;
module.exports.PERIODS = PERIODS;
