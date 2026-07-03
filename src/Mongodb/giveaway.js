'use strict';

const mongoose = require('mongoose');

/* ─────────────────────────────────────────
   SUB-SCHEMAS
───────────────────────────────────────── */

const BonusEntrySchema = new mongoose.Schema({
  roleId:   { type: String, required: true },
  entries:  { type: Number, required: true, min: 1 },
  label:    { type: String, default: '' },
}, { _id: false });

const RequirementSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      // Servidor atual — gratuito
      'REQUIRED_ROLE',
      'FORBIDDEN_ROLE',
      'MIN_MESSAGES',
      'MIN_DAYS_IN_SERVER',
      'MIN_ACCOUNT_AGE',
      // Outro servidor — gratuito
      'IN_SERVER',
      // Outro servidor — premium
      'REQUIRED_ROLE_IN_SERVER',
      'FORBIDDEN_ROLE_IN_SERVER',
      'MIN_DAYS_IN_EXT_SERVER',
      'MIN_MESSAGES_IN_EXT_SERVER',
      'MIN_HOURS_IN_CALL',
      'MIN_LEVEL',
      'MIN_XP',
      'HAS_BOOSTER_ROLE',
      'HAS_SUPPORTER_ROLE',
    ]
  },
  value:    { type: mongoose.Schema.Types.Mixed, default: null }, // roleId, guildId, número...
  guildId:  { type: String, default: null },   // para requisitos de outro servidor
  label:    { type: String, default: '' },
}, { _id: false });

const ParticipantSchema = new mongoose.Schema({
  userId:       { type: String, required: true },
  guildId:      { type: String, required: true }, // guild de origem da participação
  baseEntries:  { type: Number, default: 1 },
  bonusEntries: { type: Number, default: 0 },
  totalEntries: { type: Number, default: 1 },
  joinedAt:     { type: Date,   default: Date.now },
  // resultado do sorteio
  drawPosition: { type: Number, default: null },   // posição em que foi sorteado
  status: {
    type: String,
    enum: ['participating', 'winner', 'disqualified', 'would_have_won'],
    default: 'participating'
  },
  disqualifyReason: { type: String, default: null },
}, { _id: false });

const MultiServerConfigSchema = new mongoose.Schema({
  guildId:  { type: String, required: true },
  label:    { type: String, default: '' },
  winners:  { type: Number, default: 0 }, // 0 = modo global
  messageId: { type: String, default: null },
  channelId: { type: String, default: null },
}, { _id: false });

const ModalFieldSchema = new mongoose.Schema({
  customId:    { type: String, required: true },
  label:       { type: String, required: true },
  style:       { type: Number, default: 1 },     // 1=curta, 2=longa
  required:    { type: Boolean, default: true },
  placeholder: { type: String, default: '' },
  minLength:   { type: Number, default: 0 },
  maxLength:   { type: Number, default: 4000 },
}, { _id: false });

/* ─────────────────────────────────────────
   SCHEMA PRINCIPAL
───────────────────────────────────────── */

const GiveawaySchema = new mongoose.Schema({

  /* identificação */
  giveawayId:  { type: String, required: true, unique: true }, // "giveaway_<timestamp>"
  guildId:     { type: String, required: true },
  channelId:   { type: String, required: true },
  messageId:   { type: String, default: null },
  createdBy:   { type: String, required: true }, // userId

  /* informações */
  prize:       { type: String, required: true },
  description: { type: String, default: '' },
  winners:     { type: Number, default: 1 },
  color:       { type: Number, default: 0xFFB7C5 },
  thumbnail:   { type: String, default: null },
  banner:      { type: String, default: null },
  customMessage: { type: String, default: null },

  /* tempo */
  duration:    { type: Number, default: null },   // ms
  endsAt:      { type: Date,   required: true },
  pausedAt:    { type: Date,   default: null },
  pausedDuration: { type: Number, default: 0 },   // ms acumulados em pausa

  /* estado */
  status: {
    type: String,
    enum: ['active', 'paused', 'ended', 'cancelled'],
    default: 'active'
  },

  /* configurações */
  bonusEntries:  { type: [BonusEntrySchema],       default: [] },
  requirements:  { type: [RequirementSchema],      default: [] },
  participants:  { type: [ParticipantSchema],      default: [] },

  /* multi-servidor */
  isMultiServer: { type: Boolean, default: false },
  multiMode: {
    type: String,
    enum: ['global', 'separate'],
    default: 'global'
  },
  multiServers:  { type: [MultiServerConfigSchema], default: [] },

  /* resultado */
  endedAt:       { type: Date, default: null },
  drawHistory:   { type: mongoose.Schema.Types.Mixed, default: [] },
  /*
    drawHistory: Array<{
      position: number,
      userId: string,
      status: 'winner' | 'disqualified' | 'would_have_won',
      reason: string | null
    }>
  */

}, {
  timestamps: true,
  collection: 'giveaways',
});

/* índices */
GiveawaySchema.index({ guildId: 1, status: 1 });
GiveawaySchema.index({ endsAt: 1, status: 1 });
GiveawaySchema.index({ 'participants.userId': 1 });

module.exports = mongoose.models.Giveaway || mongoose.model('Giveaway-Test', GiveawaySchema);
