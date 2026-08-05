'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const TYPES = Object.freeze({
  FOLLOW:    'follow',
  SUBSCRIBE: 'subscribe',
  RESUB:     'resub',
  GIFT_SUB:  'giftsub',
  BITS:      'bits',
  RAID:      'raid',
});

const TYPE_LABELS = Object.freeze({
  [TYPES.FOLLOW]:    'Novo Seguidor',
  [TYPES.SUBSCRIBE]: 'Nova Inscrição',
  [TYPES.RESUB]:     'Renovação de Inscrição',
  [TYPES.GIFT_SUB]:  'Inscrição Presenteada',
  [TYPES.BITS]:      'Bits',
  [TYPES.RAID]:      'Raid',
});

const DEFAULT_MESSAGES = Object.freeze({
  [TYPES.FOLLOW]:    '💜 **{user}** começou a seguir o canal!',
  [TYPES.SUBSCRIBE]: '🎉 **{user}** acabou de se inscrever no canal!',
  [TYPES.RESUB]:     '🔥 **{user}** renovou a inscrição por **{months}** meses!',
  [TYPES.GIFT_SUB]:  '🎁 **{user}** presenteou **{count}** inscrição(ões) para a comunidade!',
  [TYPES.BITS]:      '💎 **{user}** enviou **{bits}** bits!',
  [TYPES.RAID]:      '⚔️ **{user}** trouxe uma raid com **{viewers}** viewers!',
});

const twitchAlertSchema = new Schema({
  guildId:  { type: String, required: true, index: true },
  platform: { type: String, required: true, default: 'twitch', index: true },

  type: { type: String, required: true, enum: Object.values(TYPES) },

  active: { type: Boolean, default: true },

  
  discordChannelId: { type: String, required: true },

  
  
  
  
  roleId: { type: String, default: null },

  
  message: { type: String, required: true },

  
  
  
  
  
  minAmount: { type: Number, default: null, min: 0 },

  usageCount:      { type: Number, default: 0 },
  lastTriggeredAt: { type: Date, default: null },

  createdBy: { type: String, default: null }, 
}, {
  timestamps: true,
  collection: 'twitch_alerts',
});

twitchAlertSchema.index({ guildId: 1, platform: 1, type: 1 });

module.exports = mongoose.models.TwitchAlert
  || mongoose.model('TwitchAlert', twitchAlertSchema);

module.exports.TYPES = TYPES;
module.exports.TYPE_LABELS = TYPE_LABELS;
module.exports.DEFAULT_MESSAGES = DEFAULT_MESSAGES;
