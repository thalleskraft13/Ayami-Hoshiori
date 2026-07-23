'use strict';

const { Schema, model } = require("mongoose");


const escalationLevelSchema = new Schema({
  warns:  { type: Number, required: true },
  action: { type: String, required: true }
  // actions: "warn_message" | "timeout_10m" | "timeout_1h" | "timeout_24h" | "kick" | "ban"
}, { _id: false });

const simpleModuleSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },  // multiple actions
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] }
}, { _id: false });

const badwordsSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  list:            { type: [String], default: [] },
  nativeRuleId:    { type: String, default: null }
}, { _id: false });

const antispamSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  maxMessages:     { type: Number, default: 5 },
  intervalSeconds: { type: Number, default: 5 },
  nativeRuleId:    { type: String, default: null }
}, { _id: false });

const anticapsSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  percent:         { type: Number, default: 70 },
  minLength:       { type: Number, default: 10 }
}, { _id: false });

const antilinksSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  allowedDomains:  { type: [String], default: [] },
  blockedDomains:  { type: [String], default: [] },
  blockInvites:    { type: Boolean, default: false },
  nativeRuleId:    { type: String, default: null },
  invitesRuleId:   { type: String, default: null }
}, { _id: false });

const antimentionSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  maxMentions:     { type: Number, default: 5 },
  nativeRuleId:    { type: String, default: null }
}, { _id: false });

const antiemojiSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  maxEmojis:       { type: Number, default: 10 }
}, { _id: false });

const antifilesSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  blockedExtensions: { type: [String], default: ["exe", "bat", "scr", "cmd", "msi", "vbs", "jar"] }
}, { _id: false });

const warnEntrySchema = new Schema({
  userId:    { type: String, required: true },
  reason:    { type: String, required: true },
  moderator: { type: String, required: true },
  date:      { type: String, required: true },
  module:    { type: String, default: "manual" }
}, { _id: false });

const securityAdvancedSchema = new Schema({
  logNewAccounts:    { type: Boolean, default: false },
  suspectUsers:      { type: Boolean, default: false },
  autoPunish:        { type: Boolean, default: false },
  globalEscalation:  { type: [escalationLevelSchema], default: [] },
  warns:             { type: [warnEntrySchema], default: [] },
  escalationState:  { type: Object, default: {} }
}, { _id: false });

const securitySimpleSchema = new Schema({
  badwords:    { type: badwordsSchema,    default: () => ({}) },
  antispam:    { type: antispamSchema,    default: () => ({}) },
  anticaps:    { type: anticapsSchema,    default: () => ({}) },
  antilinks:   { type: antilinksSchema,   default: () => ({}) },
  antimention: { type: antimentionSchema, default: () => ({}) },
  antiemoji:   { type: antiemojiSchema,   default: () => ({}) },
  antifiles:   { type: antifilesSchema,   default: () => ({}) }
}, { _id: false });

const channelSnapshotSchema = new Schema({
  channelId:     { type: String, required: true },
  originalAllow: { type: String, default: "0" },
  originalDeny:  { type: String, default: "0" }
}, { _id: false });

const emergencyLogSchema = new Schema({
  timestamp: { type: Number, required: true },
  event:     { type: String, required: true }
}, { _id: false });

const emergencySchema = new Schema({
  active:          { type: Boolean, default: false },
  blockMessages:   { type: Boolean, default: false },
  blockInvites:    { type: Boolean, default: false },
  timerMinutes:    { type: Number,  default: null  },
  channelSnapshot: { type: [channelSnapshotSchema], default: [] },
  logs:            { type: [emergencyLogSchema],     default: [] }
}, { _id: false });

const monitoringChangeSchema = new Schema({
  timestamp:   { type: Number, required: true },
  type:        { type: String, required: true },
  description: { type: String, required: true }
}, { _id: false });

const monitoringSchema = new Schema({
  permChanges:     { type: Boolean, default: false },
  adminRoleCreate: { type: Boolean, default: false },
  botAdded:        { type: Boolean, default: false },
  webhookCreated:  { type: Boolean, default: false },
  channelChanges:  { type: Boolean, default: false },
  changeHistory:   { type: [monitoringChangeSchema], default: [] }
}, { _id: false });

const raidFactorHitSchema = new Schema({
  key:    { type: String, required: true },
  score:  { type: Number, required: true },
  detail: { type: String, default: "" }
}, { _id: false });

const raidHistorySchema = new Schema({
  timestamp: { type: Number, required: true },
  score:     { type: Number, required: true },   // risk score final (0-100)
  factors:   { type: [raidFactorHitSchema], default: [] },
  action:    { type: String, required: true },
  restored:  { type: Boolean, default: false },  // true quando o auto-restore já rodou para este evento
  restoredAt:{ type: Number, default: null }
}, { _id: false });

const raidFactorJoinRateSchema = new Schema({
  enabled:  { type: Boolean, default: true },
  joinLimit:{ type: Number,  default: 10 }   
}, { _id: false });

const raidFactorNewAccountsSchema = new Schema({
  enabled:      { type: Boolean, default: true },
  maxAgeHours:  { type: Number,  default: 24 },  // conta é "recém-criada" se mais nova que isso
  ratioPercent: { type: Number,  default: 50 }   
}, { _id: false });

const raidFactorDuplicateMessagesSchema = new Schema({
  enabled:  { type: Boolean, default: true },
  minCount: { type: Number,  default: 5 }  
}, { _id: false });

const raidFactorCoordinatedSpamSchema = new Schema({
  enabled:   { type: Boolean, default: true },
  minUsers:  { type: Number,  default: 6 },   // usuários distintos mandando mensagens no mesmo burst
  windowSec: { type: Number,  default: 10 }
}, { _id: false });

const raidFactorMassMentionsSchema = new Schema({
  enabled:  { type: Boolean, default: true },
  minCount: { type: Number,  default: 15 }  
}, { _id: false });

const raidFactorMassInvitesSchema = new Schema({
  enabled:  { type: Boolean, default: true },
  minCount: { type: Number,  default: 4 }   
}, { _id: false });

const raidFactorsSchema = new Schema({
  joinRate:           { type: raidFactorJoinRateSchema,           default: () => ({}) },
  newAccounts:        { type: raidFactorNewAccountsSchema,        default: () => ({}) },
  duplicateMessages:  { type: raidFactorDuplicateMessagesSchema,  default: () => ({}) },
  coordinatedSpam:    { type: raidFactorCoordinatedSpamSchema,    default: () => ({}) },
  massMentions:       { type: raidFactorMassMentionsSchema,       default: () => ({}) },
  massInvites:        { type: raidFactorMassInvitesSchema,        default: () => ({}) }
}, { _id: false });

const raidSchema = new Schema({
  enabled:          { type: Boolean, default: false },
  riskThreshold:    { type: Number,  default: 60 },     // score 0-100 para acionar a resposta
  action:           { type: String,  default: "nothing" }, // nothing | timeout | kick | ban | lockdown | quarantine
  quarantineRoleId: { type: String,  default: null },
  autoLockdown:     { type: Boolean, default: false },  // ativa Modo Emergência junto com a ação
  autoRestore:      { type: Boolean, default: true },   // desativa a emergência sozinho quando o ataque acabar
  restoreAfterMinutes: { type: Number, default: 10 },    // minutos de calmaria exigidos antes de restaurar
  earlyAlerts:      { type: Boolean, default: false },
  factors:          { type: raidFactorsSchema, default: () => ({}) },
  history:          { type: [raidHistorySchema], default: [] },
  state: {
    emergencyActive: { type: Boolean, default: false },
    lastHighRiskAt:  { type: Number,  default: null },
    flaggedUserIds:  { type: [String], default: [] } 
  }
}, { _id: false });


const backupRoleSchema = new Schema({
  id:          String,
  name:        String,
  color:       Number,
  hoist:       Boolean,
  position:    Number,
  permissions: String,
  mentionable: Boolean
}, { _id: false });

const permOverwriteSchema = new Schema({
  id:    String,
  type:  Number,
  allow: String,
  deny:  String
}, { _id: false });

const backupCategorySchema = new Schema({
  id:                    String,
  name:                  String,
  position:              Number,
  permission_overwrites: { type: [permOverwriteSchema], default: [] }
}, { _id: false });

const backupChannelSchema = new Schema({
  id:                    String,
  name:                  String,
  type:                  Number,
  position:              Number,
  parent_id:             { type: String, default: null },
  category:              { type: String, default: null },
  topic:                 { type: String, default: null },
  nsfw:                  { type: Boolean, default: false },
  slowmode_delay:        { type: Number, default: 0 },
  permission_overwrites: { type: [permOverwriteSchema], default: [] }
}, { _id: false });

const backupEntrySchema = new Schema({
  id:          { type: String, required: true },
  createdAt:   { type: Number, required: true },
  incremental: { type: Boolean, default: false },
  guildName:   { type: String, default: "" },
  roles:       { type: [backupRoleSchema],     default: [] },
  categories:  { type: [backupCategorySchema], default: [] },
  channels:    { type: [backupChannelSchema],  default: [] }
}, { _id: false });

const activityAnalyticsSchema = new Schema({
  enabled:         { type: Boolean, default: true  },
  ignoreBots:      { type: Boolean, default: true  },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  ignoredUsers:    { type: [String], default: [] },
  timezoneOffset:  { type: Number, default: -3, min: -12, max: 14 },
}, { _id: false });

const verificationViolationSchema = new Schema({
  key:   { type: String, required: true },  // minAccountAge | requireCustomAvatar
  label: { type: String, required: true }   
}, { _id: false });

const verificationHistorySchema = new Schema({
  timestamp:  { type: Number, required: true },
  userId:     { type: String, required: true },
  username:   { type: String, default: "" },
  violations: { type: [verificationViolationSchema], default: [] },
  action:     { type: String, required: true } 
}, { _id: false });

const verificationRuleMinAgeSchema = new Schema({
  enabled: { type: Boolean, default: false },
  hours:   { type: Number,  default: 48 }
}, { _id: false });

const verificationRuleAvatarSchema = new Schema({
  enabled: { type: Boolean, default: false }
}, { _id: false });

const verificationSchema = new Schema({
  enabled: { type: Boolean, default: false },
  rules: {
    minAccountAge:       { type: verificationRuleMinAgeSchema, default: () => ({}) },
    requireCustomAvatar: { type: verificationRuleAvatarSchema, default: () => ({}) }
  },
  mode:             { type: String,  default: "log_only" }, // log_only | auto_punish
  logSuspicious:    { type: Boolean, default: true },        // registra mesmo as violações no modo log_only
  punishment:       { type: String,  default: "none" },      // none | log | timeout | kick | ban | quarantine
  quarantineRoleId: { type: String,  default: null },
  history:          { type: [verificationHistorySchema], default: [] }
}, { _id: false });

const trapChannelHistorySchema = new Schema({
  timestamp:        { type: Number, required: true },
  userId:           { type: String, required: true },
  username:         { type: String, default: "" },
  action:           { type: String, required: true }, // log | timeout | kick | ban
  deletedElsewhere: { type: Number, default: 0 }       
}, { _id: false });

const trapChannelSchema = new Schema({
  enabled:                     { type: Boolean, default: false },
  channelId:                   { type: String,  default: null },
  punishment:                  { type: String,  default: "log" }, // log | timeout | kick | ban
  logChannelId:                { type: String,  default: null },  // opcional; sem isso cai no logs.channels.main
  deleteRecentMessages:        { type: Boolean, default: false },
  recentMessagesWindowMinutes: { type: Number,  default: 5 },
  ignoredRoles:                { type: [String], default: [] },
  ignoredUsers:                { type: [String], default: [] },
  ignoredBots:                 { type: [String], default: [] },
  warningMessageSent:          { type: Boolean, default: false }, // já postamos o aviso fixo neste canal
  history:                     { type: [trapChannelHistorySchema], default: [] }
}, { _id: false });

const securitySchema = new Schema({
  automod: {
    simple:   { type: securitySimpleSchema,   default: () => ({}) },
    advanced: { type: securityAdvancedSchema, default: () => ({}) }
  },
  roles: {
    staff:             { type: [String], default: [] },
    immune:            { type: [String], default: [] },
    permAlertsEnabled: { type: Boolean,  default: false }
  },
  logs: {
    mode:     { type: String, default: "single" },
    channels: { type: Object, default: {} },
    types:    { type: Object, default: {} }
  },
  raid:       { type: raidSchema,       default: () => ({}) },
  verification: { type: verificationSchema, default: () => ({}) },
  trapChannel: { type: trapChannelSchema, default: () => ({}) },
  emergency:  { type: emergencySchema,  default: () => ({}) },
  monitoring: { type: monitoringSchema, default: () => ({}) },
  backups:    { type: [backupEntrySchema], default: [] }
}, { _id: false });


const birthdayConfigSchema = new Schema({
  ativado:        { type: Boolean, default: false },
  channel:        { type: String,  default: "0" },
  ping:           { type: String,  default: "0" },
  birthdayRole:   { type: String,  default: "0" },
  birthdayThread: { type: Boolean, default: false },
  webhook:        { type: Boolean, default: false },
  webhookName:    { type: String,  default: null  },
  webhookAvatar:  { type: String,  default: null  },
  pinMessage:     { type: Boolean, default: false },
  _pinMsgId:      { type: String,  default: null  },
  hour:           { type: Number,  default: 8     },
  minute:         { type: Number,  default: 0     },
  messageText:    { type: String,  default: "🎂 Hoje é o aniversário de {user}! Parabéns! 🎉" }
}, { _id: false });

const modalFieldSchema = new Schema({
  label:       String,
  customId:    String,
  style:       Number,
  required:    Boolean,
  placeholder: String,
  minLength:   Number,
  maxLength:   Number
}, { _id: false });

const modalConfigSchema = new Schema({
  enabled:      { type: Boolean, default: false },
  title:        { type: String,  default: "Formulário do Ticket" },
  sendMode:     { type: Number,  default: 0 },
  logChannelId: { type: String,  default: null },
  fields:       { type: [modalFieldSchema], default: [] }
}, { _id: false });

const autoRoleEntrySchema = new Schema({
  roleId:   { type: String, required: true },
  tipo:     { type: Number, enum: [0, 1, 2], default: 0 },
  duration: { type: Number, default: null }
}, { _id: false });

const autoRoleConfigSchema = new Schema({
  enabled: { type: Boolean, default: false },
  roles:   { type: [autoRoleEntrySchema], default: [] }
}, { _id: false });

const seqQuestionSchema = new Schema({
  id:          { type: String,  required: true },
  label:       { type: String,  required: true },
  tipo:        { type: String,  default: "text" },
  required:    { type: Boolean, default: true  },
  placeholder: { type: String,  default: ""    },
  options:     { type: [String], default: []   },
  maxLength:   { type: Number,  default: 2000  }
}, { _id: false });

const seqQuestionsConfigSchema = new Schema({
  enabled:      { type: Boolean, default: false   },
  sendMode:     { type: Number,  default: 0       },
  logChannelId: { type: String,  default: null    },
  timeout:      { type: Number,  default: 120_000 },
  questions:    { type: [seqQuestionSchema], default: [] }
}, { _id: false });

const transcriptConfigSchema = new Schema({
  enabled:    { type: Boolean, default: false  },
  channelId:  { type: String,  default: null   },
  format:     { type: String,  default: "html", enum: ["html", "txt"] },
  sendToUser: { type: Boolean, default: false  }
}, { _id: false });

const selectMenuOptionSchema = new Schema({
  optionId:       { type: String, required: true }, // id interno único da opção
  label:          { type: String, required: true },
  description:    { type: String, default: ""   },
  emoji:          { type: String, default: null },

  cargosStaff:    { type: [String], default: [] },
  ticketChatName: { type: String,  default: null },

  embedBoasVindas: { type: Object, default: null }, // embed exibida dentro do ticket criado por esta opção

  modalConfig:        { type: modalConfigSchema,        default: () => ({}) },
  seqQuestionsConfig:  { type: seqQuestionsConfigSchema, default: () => ({}) }
}, { _id: false });

const selectMenuConfigSchema = new Schema({
  enabled:     { type: Boolean, default: false },
  placeholder: { type: String,  default: "Selecione o tipo de atendimento" },
  options:     { type: [selectMenuOptionSchema], default: [] }
}, { _id: false });

const ticketMensagensConfigSchema = new Schema({
  ticketCriadoTitulo:    { type: String, default: null }, // padrão: "🎫 Ticket Criado"
  ticketCriadoDescricao: { type: String, default: null }, // padrão: mensagem atual

  fecharBotaoLabel:      { type: String, default: null }, // padrão: "Fechar Ticket"
  fechandoMensagem:      { type: String, default: null }, // padrão: "⛔ Ticket será fechado em 10 segundos..."

  modalRespostasTitulo:  { type: String, default: null }, // padrão: "📋 Respostas do Formulário"

  seqInicioTitulo:       { type: String, default: null }, // padrão: "📋 Formulário de Atendimento"
  seqInicioDescricao:    { type: String, default: null }, // padrão: mensagem atual (usa {user} e {timeout})
  seqCanceladoMensagem:  { type: String, default: null }, // padrão: "⚠️ Formulário encerrado."
  seqResumoTitulo:       { type: String, default: null }, // padrão: "✅ Respostas Recebidas"

  transcriptTitulo:      { type: String, default: null }, // padrão: "📄 Transcript"
  transcriptDmTitulo:    { type: String, default: null }, // padrão: "📄 Seu Transcript"
  transcriptDmDescricao: { type: String, default: null }, // padrão: mensagem atual
}, { _id: false });

const ticketSchema = new Schema({
  panelId:         { type: String, required: true },
  categoriaId:     { type: String, default: null  },
  canalId:         { type: String, default: null  },
  painelPrincipal: { type: Object, default: null  },
  messageId:       { type: String, default: null  },
  cargosStaff:     { type: [String], default: []  },
  ticketChatName:  { type: String, default: null  },
  contadorTicket:  { type: Number, default: 0     },
  tipoDeCriacao:   { type: Number, enum: [0, 1, 2], default: 0 },
  modalConfig:         { type: modalConfigSchema,        default: () => ({}) },
  autoRoleConfig:      { type: autoRoleConfigSchema,     default: () => ({}) },
  seqQuestionsConfig:  { type: seqQuestionsConfigSchema, default: () => ({}) },
  transcriptConfig:    { type: transcriptConfigSchema,   default: () => ({}) },
  selectMenuConfig:    { type: selectMenuConfigSchema,   default: () => ({}) },
  mensagensConfig:     { type: ticketMensagensConfigSchema, default: () => ({}) },

  useComponentsV2:     { type: Boolean, default: false },
  painelComponentsV2:  { type: [Schema.Types.Mixed], default: [] }
}, { _id: false });


const pendingTempRoleSchema = new Schema({
  guildId:  { type: String, required: true },
  userId:   { type: String, required: true },
  roleId:   { type: String, required: true },
  panelId:  { type: String, required: true },
  ticketId: { type: String, required: true },
  removeAt: { type: Number, required: true },
  removed:  { type: Boolean, default: false }
});

const activeLinkedRoleSchema = new Schema({
  guildId:  { type: String, required: true },
  userId:   { type: String, required: true },
  roleId:   { type: String, required: true },
  panelId:  { type: String, required: true },
  ticketId: { type: String, required: true }
});


const guildSchema = new Schema({
  guildId:     { type: String, required: true, unique: true },
  premiumUser: { type: String, default: "0" },
  premiumTime: { type: Number, default: 0   },
  premiumPlan: { type: String, default: null }, // FREE | NOVA_ESTRELA | LUA_CRESCENTE | CONSTELLATION — veja function/Utils/PremiumPlans.js
  ticket:      { type: [ticketSchema], default: [] },

  uidSend: {
    ativado: { type: Boolean, default: false },
    webhook: { type: Boolean, default: false },
    channel: { type: String,  default: "0"   }
  },

  starboard: {
    chat:   { type: String,  default: "0"  },
    emoji:  { type: String,  default: "⭐" },
    salvar: { type: Boolean, default: true }
  },

  genshinAnuncios: {
    vazamentos: {
      chat: { type: String, default: "0" },
      ping: { type: String, default: "0" }
    }
  },

  birthdayConfig: { type: birthdayConfigSchema, default: () => ({}) },

  webhooks: {
    componentsV2: {
      enabled: { type: Boolean, default: false },
      items: {
        type: [{
          channelId:    String,
          webhookId:    String,
          webhookToken: String,
          url:          String,
          createdAt:    Number
        }],
        default: []
      }
    }
  },

  security: { type: securitySchema, default: () => ({}) },

  activityAnalytics: { type: activityAnalyticsSchema, default: () => ({}) }
});


const GuildModel            = model("Guild",     guildSchema);
const PendingTempRoleModel  = model("PendingTempRole",  pendingTempRoleSchema);
const ActiveLinkedRoleModel = model("ActiveLinkedRole", activeLinkedRoleSchema);

module.exports = {
  GuildDb: GuildModel,
  PendingTempRoleModel,
  ActiveLinkedRoleModel
};
