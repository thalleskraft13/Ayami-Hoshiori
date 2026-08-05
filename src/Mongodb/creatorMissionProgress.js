'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PLATFORMS } = require('./creatorAccountLink.js');

const rewardStateSchema = new Schema({
  
  
  status:       { type: String, enum: ['pending', 'registered'], default: 'pending' },
  registeredAt: { type: Date, default: null },
}, { _id: false });

const creatorMissionProgressSchema = new Schema({
  missionId: { type: Schema.Types.ObjectId, ref: 'CreatorMission', required: true },

  guildId:  { type: String, required: true }, 
  platform: { type: String, required: true, enum: PLATFORMS },

  discordUserId:  { type: String, required: true },
  platformUserId: { type: String, required: true }, 

  progress: { type: Number, default: 0 },
  target:   { type: Number, default: 1 }, 

  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },

  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },

  reward: { type: rewardStateSchema, default: () => ({}) },
}, {
  timestamps: true,
  collection: 'creator_mission_progress',
});

creatorMissionProgressSchema.index({ missionId: 1, discordUserId: 1 }, { unique: true });
creatorMissionProgressSchema.index({ guildId: 1, discordUserId: 1 });
creatorMissionProgressSchema.index({ discordUserId: 1, platform: 1 });

module.exports = mongoose.models.CreatorMissionProgress
  || mongoose.model('CreatorMissionProgress', creatorMissionProgressSchema);
