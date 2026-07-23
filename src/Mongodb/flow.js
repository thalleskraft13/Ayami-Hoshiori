'use strict';

const { Schema, model } = require('mongoose');


const libraryFlowSchema = new Schema({
  libId:        { type: String, required: true, unique: true },
  authorId:     { type: String, required: true },   // userId Discord
  authorName:   { type: String, default: '' },

  name:         { type: String, required: true },
  shortDesc:    { type: String, default: '', maxlength: 150 },
  fullDesc:     { type: String, default: '', maxlength: 2000 },

  category: {
    type: String,
    enum: [
      'Moderação','Economia','Automação','Logs','Tickets',
      'Recompensas','Eventos','RPG','Utilidade','Comunidade',
      'Diversão','Outros'
    ],
    default: 'Outros'
  },

  tags:    { type: [String], default: [] },
  version: { type: String, default: '1.0.0' },

  flows: { type: [Schema.Types.Mixed], default: [] },

  templateVars: { type: [String], default: [] },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'   
  },

  stats: {
    installs:     { type: Number, default: 0 },
    likes:        { type: Number, default: 0 },
    dislikes:     { type: Number, default: 0 },
    avgRating:    { type: Number, default: 0 },
    ratingCount:  { type: Number, default: 0 },
    weeklyScore:  { type: Number, default: 0 }  
  },

  publishedAt: { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },

  lastChangelog: { type: String, default: '' },

  versionHistory: {
    type: [{
      version:    { type: String },
      changelog:  { type: String, default: '' },
      archivedAt: { type: Date }
    }],
    default: []
  }
});

libraryFlowSchema.index({ 'stats.installs': -1 });
libraryFlowSchema.index({ 'stats.avgRating': -1 });
libraryFlowSchema.index({ 'stats.weeklyScore': -1 });
libraryFlowSchema.index({ category: 1, status: 1 });
libraryFlowSchema.index({ tags: 1, status: 1 });

const libraryRatingSchema = new Schema({
  libId:   { type: String, required: true },
  userId:  { type: String, required: true },
  rating:  { type: Number, min: 1, max: 5, default: null },
  vote:    { type: String, enum: ['like', 'dislike'], default: null }
});
libraryRatingSchema.index({ libId: 1, userId: 1 }, { unique: true });

const creatorProfileSchema = new Schema({
  userId:      { type: String, required: true, unique: true },
  username:    { type: String, default: '' },
  bio:         { type: String, default: '', maxlength: 300 },
  followers:   { type: [String], default: [] },   // userIds que seguem
  following:   { type: [String], default: [] },   // userIds que este segue
  publishedAt: { type: Date, default: Date.now }
});

const libraryInstallSchema = new Schema({
  libId:       { type: String, required: true },
  guildId:     { type: String, required: true },
  installedBy: { type: String, required: true },   // userId
  flowIds:     { type: [String], default: [] },    // IDs criados no guild
  version:     { type: String, default: '1.0.0' },
  installedAt: { type: Date, default: Date.now }
});
libraryInstallSchema.index({ libId: 1, guildId: 1 });





const conditionSchema = new Schema({
  id: { type: String, required: true },

  category: { type: String, required: true },

  type: { type: String, required: true },

  params: { type: Schema.Types.Mixed, default: {} },

  operator: { type: String, enum: ['AND', 'OR'], default: 'AND' },

  negate: { type: Boolean, default: false }

}, { _id: false });


const actionSchema = new Schema({
  id: { type: String, required: true },

  category: { type: String, required: true },

  type: { type: String, required: true },

  params: { type: Schema.Types.Mixed, default: {} },

  order: { type: Number, default: 0 }

}, { _id: false });


const triggerSchema = new Schema({
  category: { type: String, required: true },

  type: { type: String, required: true },

  filters: { type: Schema.Types.Mixed, default: {} }

}, { _id: false });


const flowVariableSchema = new Schema({
  name:         { type: String, required: true },
  defaultValue: { type: Schema.Types.Mixed, default: null },
  scope: { type: String, enum: ['flow', 'user'], default: 'flow' },

  type:         { type: String, default: 'string' },

  persistent:   { type: Boolean, default: false }

}, { _id: false });


const flowSchema = new Schema({
  flowId:   { type: String, required: true, unique: true },
  guildId:  { type: String, required: true, index: true },

  name:        { type: String, required: true },
  description: { type: String, default: '' },

  enabled:  { type: Boolean, default: true },

  trigger:    { type: triggerSchema,    required: true },
  conditions: { type: [conditionSchema], default: [] },
  actions:    { type: [actionSchema],   default: [] },
  variables:  { type: [flowVariableSchema], default: [] },

  executionMode: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },

  cooldown: { type: Number, default: 0 },

  cooldownMap: { type: Map, of: Number, default: {} },

  createdBy: { type: String, default: null },
  createdAt: { type: Date,   default: Date.now },
  updatedAt: { type: Date,   default: Date.now },

  stats: {
    totalRuns:   { type: Number, default: 0 },
    successRuns: { type: Number, default: 0 },
    failedRuns:  { type: Number, default: 0 },
    lastRunAt:   { type: Date,   default: null }
  }
});

flowSchema.index({ guildId: 1, 'trigger.category': 1, 'trigger.type': 1, enabled: 1 });


const customCommandSchema = new Schema({
  commandId: { type: String, required: true, unique: true },
  guildId:   { type: String, required: true, index: true },

  name:        { type: String, required: true },   // "daily", "pescar", "abrir"
  aliases:     { type: [String], default: [] },
  description: { type: String, default: '' },

  prefix:   { type: String, default: '!' },
  enabled:  { type: Boolean, default: true },

  flowId: { type: String, required: true },

  cooldown: { type: Number, default: 0 },
  cooldownMap: { type: Map, of: Number, default: {} },

  permissions: { type: [String], default: [] },

  requiredRoles: { type: [String], default: [] }
});

customCommandSchema.index({ guildId: 1, name: 1 });
customCommandSchema.index({ guildId: 1, aliases: 1 });


const persistentVarSchema = new Schema({
  guildId: { type: String, required: true },
  flowId:  { type: String, required: true },
  name:    { type: String, required: true },
  value:   { type: Schema.Types.Mixed, default: null },
  updatedAt: { type: Date, default: Date.now }
});

persistentVarSchema.index({ guildId: 1, name: 1 }, { unique: true });


const flowRunLogSchema = new Schema({
  flowId:  { type: String, required: true, index: true },
  guildId: { type: String, required: true },

  result: { type: String, required: true },

  context: { type: Schema.Types.Mixed, default: {} },

  error:    { type: String, default: null },
  duration: { type: Number, default: 0 },  // ms

runAt: { type: Date, default: Date.now }  
});

flowRunLogSchema.index({ runAt: 1 }, { expireAfterSeconds: 604800 });


const userVarSchema = new Schema({
  guildId: { type: String, required: true },
  userId:  { type: String, required: true },
  flowId:  { type: String, required: true },
  name:    { type: String, required: true },
  value:   { type: Schema.Types.Mixed, default: null },
  updatedAt: { type: Date, default: Date.now }
});

userVarSchema.index({ guildId: 1, userId: 1, flowId: 1, name: 1 }, { unique: true });

const UserVarModel = model('UserVar', userVarSchema);




module.exports = {
  FlowModel:          model('Flow',          flowSchema),
  CustomCommandModel: model('CustomCommand', customCommandSchema),
  PersistentVarModel: model('PersistentVar', persistentVarSchema),
  FlowRunLogModel:    model('FlowRunLog',    flowRunLogSchema),
  UserVarModel: model("userVarSchema", userVarSchema),
  LibraryFlowModel:    model('LibraryFlow',    libraryFlowSchema),
  LibraryRatingModel:  model('LibraryRating',  libraryRatingSchema),
  CreatorProfileModel: model('CreatorProfile', creatorProfileSchema),
  LibraryInstallModel: model('LibraryInstall', libraryInstallSchema),
};
