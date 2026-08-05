'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const welcomeMessageSchema = new Schema({
  type:    { type: String, enum: ['normal', 'embed'], default: 'embed' },
  content: { type: String, default: null },
  embed:   { type: Schema.Types.Mixed, default: null },
}, { _id: false });

const stepOptionSchema = new Schema({
  label:       { type: String, required: true },
  value:       { type: String, required: true },
  description: { type: String, default: null },
  characterId: { type: Schema.Types.ObjectId, ref: 'HouseCharacter', default: null },
}, { _id: false });

const stepSchema = new Schema({
  id:          { type: String, required: true },
  name:        { type: String, required: true },
  description: { type: String, default: null },
  type:        { type: String, enum: ['button', 'select', 'modal', 'texto'], required: true },
  required:    { type: Boolean, default: true },
  isCharacter: { type: Boolean, default: false },
  options:     { type: [stepOptionSchema], default: [] },
  order:       { type: Number, default: 0 },
}, { _id: false });

const characterSelectionSchema = new Schema({
  enabled:     { type: Boolean, default: false },
  required:    { type: Boolean, default: true },
  stepName:    { type: String, default: 'Escolha seu personagem' },
  description: { type: String, default: null },
}, { _id: false });

const receptionSchema = new Schema({
  unregisteredRoleId: { type: String, default: null },
  registeredRoleId:   { type: String, default: null },
  channelId:           { type: String, default: null },
  logChannelId:         { type: String, default: null },
  welcomeMessage:      { type: welcomeMessageSchema, default: () => ({}) },
  finalMessage:         { type: welcomeMessageSchema, default: () => ({}) },
  characterSelection:   { type: characterSelectionSchema, default: () => ({}) },
  steps:               { type: [stepSchema], default: [] },
}, { _id: false });

const decorationSchema = new Schema({
  enabled:      { type: Boolean, default: false },
  format:       { type: String, default: '{name}' },
  formats:      { type: [String], default: [] },
  emojiEnabled: { type: Boolean, default: false },
}, { _id: false });

const callScheduleSchema = new Schema({
  enabled: { type: Boolean, default: false },
  hour:    { type: Number, default: null },
  minute:  { type: Number, default: 0 },
}, { _id: false });

const callInactivitySchema = new Schema({
  enabled: { type: Boolean, default: false },
  days:    { type: Number, default: 7 },
  punish:  { type: Boolean, default: true },
}, { _id: false });

const callMessageSchema = new Schema({
  type:    { type: String, enum: ['normal', 'embed'], default: 'embed' },
  content: { type: String, default: null },
  embed:   { type: Schema.Types.Mixed, default: null },
}, { _id: false });

const callConfigSchema = new Schema({
  channelId:    { type: String, default: null },
  notifyRoleId: { type: String, default: null },
  logChannelId: { type: String, default: null },
  schedule:     { type: callScheduleSchema, default: () => ({}) },
  inactivity:   { type: callInactivitySchema, default: () => ({}) },
  message:      { type: callMessageSchema, default: () => ({}) },
  duration:     { type: Number, default: null }, 
}, { _id: false });

const permissionsSchema = new Schema({
  admin:         { type: [String], default: [] },
  recepcionista: { type: [String], default: [] },
  aprovador:      { type: [String], default: [] },
  visualizador:  { type: [String], default: [] },
}, { _id: false });

const houseSchema = new Schema({
  guildId:     { type: String, required: true, unique: true, index: true },
  enabled:     { type: Boolean, default: false },
  premiumPlan: { type: String, default: null },
  reception:   { type: receptionSchema, default: () => ({}) },
  decoration:  { type: decorationSchema, default: () => ({}) },
  call:        { type: callConfigSchema, default: () => ({}) },
  permissions: { type: permissionsSchema, default: () => ({}) },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
}, {
  collection: 'houses',
});

houseSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.models.House || mongoose.model('House', houseSchema);
