'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { PLATFORMS } = require('./creatorAccountLink.js');

const EVENT_TYPES = Object.freeze({
  STARTED:          'started',           
  PROGRESS:         'progress',          
  COMPLETED:        'completed',         
  REWARD_REGISTERED:'reward_registered', 
});

const creatorMissionLedgerSchema = new Schema({
  missionId: { type: Schema.Types.ObjectId, ref: 'CreatorMission', required: true },
  guildId:   { type: String, required: true },
  platform:  { type: String, required: true, enum: PLATFORMS },

  discordUserId:  { type: String, required: true },
  platformUserId: { type: String, default: null },

  event: { type: String, required: true, enum: Object.values(EVENT_TYPES) },

  
  
  progressBefore: { type: Number, default: null },
  progressAfter:  { type: Number, default: null },

  metadata: { type: Schema.Types.Mixed, default: null },

  criadoEm: { type: Date, default: Date.now },
}, {
  collection: 'creator_mission_ledger',
});

creatorMissionLedgerSchema.index({ guildId: 1, discordUserId: 1, criadoEm: -1 });
creatorMissionLedgerSchema.index({ missionId: 1, criadoEm: -1 });

module.exports = mongoose.models.CreatorMissionLedger
  || mongoose.model('CreatorMissionLedger', creatorMissionLedgerSchema);

module.exports.EVENT_TYPES = EVENT_TYPES;
