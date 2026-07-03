'use strict';

const { Schema, model } = require("mongoose");

/* ─────────────────────────────────────────────
   SECURITY SUB-SCHEMAS
   ───────────────────────────────────────────── */

/* ── Escalation level: X warns → action ── */
const escalationLevelSchema = new Schema({
  warns:  { type: Number, required: true },
  action: { type: String, required: true }
  // actions: "warn_message" | "timeout_10m" | "timeout_1h" | "timeout_24h" | "kick" | "ban"
}, { _id: false });

/* ── Generic simple automod module ── */
const simpleModuleSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },  // multiple actions
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] }
}, { _id: false });

/* ── Badwords extends simple ── */
const badwordsSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  list:            { type: [String], default: [] }
}, { _id: false });

/* ── Antispam extends simple ── */
const antispamSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  maxMessages:     { type: Number, default: 5 },
  intervalSeconds: { type: Number, default: 5 }
}, { _id: false });

/* ── Anticaps extends simple ── */
const anticapsSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  percent:         { type: Number, default: 70 },
  minLength:       { type: Number, default: 10 }
}, { _id: false });

/* ── Antilinks extends simple ── */
const antilinksSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  allowedDomains:  { type: [String], default: [] },
  blockedDomains:  { type: [String], default: [] }
}, { _id: false });

/* ── Antimention extends simple ── */
const antimentionSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  maxMentions:     { type: Number, default: 5 }
}, { _id: false });

/* ── Warn entry ── */
const warnEntrySchema = new Schema({
  userId:    { type: String, required: true },
  reason:    { type: String, required: true },
  moderator: { type: String, required: true },
  date:      { type: String, required: true },
  module:    { type: String, default: "manual" }
}, { _id: false });

/* ── Advanced automod ── */
const securityAdvancedSchema = new Schema({
  logNewAccounts:    { type: Boolean, default: false },
  suspectUsers:      { type: Boolean, default: false },
  autoPunish:        { type: Boolean, default: false },
  globalEscalation:  { type: [escalationLevelSchema], default: [] },
  warns:             { type: [warnEntrySchema], default: [] },
  // Rastreia o último nível de escalonamento já aplicado por usuário,
  // para cada módulo + "global". Ex: { "123456789": { "badwords": 5, "global": 3 } }
  escalationState:  { type: Object, default: {} }
}, { _id: false });

/* ── Simple automod (all modules) ── */
const securitySimpleSchema = new Schema({
  badwords:    { type: badwordsSchema,    default: () => ({}) },
  antispam:    { type: antispamSchema,    default: () => ({}) },
  anticaps:    { type: anticapsSchema,    default: () => ({}) },
  antilinks:   { type: antilinksSchema,   default: () => ({}) },
  antimention: { type: antimentionSchema, default: () => ({}) }
}, { _id: false });

/* ── Channel snapshot (emergency) ── */
const channelSnapshotSchema = new Schema({
  channelId:     { type: String, required: true },
  originalAllow: { type: String, default: "0" },
  originalDeny:  { type: String, default: "0" }
}, { _id: false });

/* ── Emergency log entry ── */
const emergencyLogSchema = new Schema({
  timestamp: { type: Number, required: true },
  event:     { type: String, required: true }
}, { _id: false });

/* ── Emergency mode ── */
const emergencySchema = new Schema({
  active:          { type: Boolean, default: false },
  blockMessages:   { type: Boolean, default: false },
  blockInvites:    { type: Boolean, default: false },
  timerMinutes:    { type: Number,  default: null  },
  channelSnapshot: { type: [channelSnapshotSchema], default: [] },
  logs:            { type: [emergencyLogSchema],     default: [] }
}, { _id: false });

/* ── Monitoring change history entry ── */
const monitoringChangeSchema = new Schema({
  timestamp:   { type: Number, required: true },
  type:        { type: String, required: true },
  description: { type: String, required: true }
}, { _id: false });

/* ── Monitoring ── */
const monitoringSchema = new Schema({
  permChanges:     { type: Boolean, default: false },
  adminRoleCreate: { type: Boolean, default: false },
  botAdded:        { type: Boolean, default: false },
  webhookCreated:  { type: Boolean, default: false },
  channelChanges:  { type: Boolean, default: false },
  changeHistory:   { type: [monitoringChangeSchema], default: [] }
}, { _id: false });

/* ── Raid history entry ── */
const raidHistorySchema = new Schema({
  timestamp: { type: Number, required: true },
  count:     { type: Number, required: true },
  action:    { type: String, required: true }
}, { _id: false });

/* ── Raid detection ── */
const raidSchema = new Schema({
  enabled:      { type: Boolean, default: false },
  joinLimit:    { type: Number,  default: 10    },
  action:       { type: String,  default: "nothing" },
  autoLockdown: { type: Boolean, default: false },
  earlyAlerts:  { type: Boolean, default: false },
  history:      { type: [raidHistorySchema], default: [] }
}, { _id: false });

/* ── Activity ranking entry ── */
const activityRankingSchema = new Schema({
  userId:   { type: String, required: true },
  messages: { type: Number, default: 0     },
  lastSeen: { type: String, default: null  }
}, { _id: false });

/* ── Activity history snapshot ── */
const activityHistorySchema = new Schema({
  date:   { type: String, required: true },
  online: { type: Number, default: 0 },
  total:  { type: Number, default: 0 },
  score:  { type: Number, default: 0 }
}, { _id: false });

/* ── Dead channel entry ── */
const deadChannelSchema = new Schema({
  channelId:   { type: String, required: true },
  lastMessage: { type: Number, default: null  }
}, { _id: false });

/* ── Activity ── */
const activitySchema = new Schema({
  ranking:         { type: [activityRankingSchema],  default: [] },
  history:         { type: [activityHistorySchema],  default: [] },
  deadChannels:    { type: [deadChannelSchema],       default: [] },
  channelActivity: { type: Object, default: {} },
  userActivity:    { type: Object, default: {} }
}, { _id: false });

/* ── Backup: role entry ── */
const backupRoleSchema = new Schema({
  id:          String,
  name:        String,
  color:       Number,
  hoist:       Boolean,
  position:    Number,
  permissions: String,
  mentionable: Boolean
}, { _id: false });

/* ── Backup: permission overwrite ── */
const permOverwriteSchema = new Schema({
  id:    String,
  type:  Number,
  allow: String,
  deny:  String
}, { _id: false });

/* ── Backup: category entry ── */
const backupCategorySchema = new Schema({
  id:                    String,
  name:                  String,
  position:              Number,
  permission_overwrites: { type: [permOverwriteSchema], default: [] }
}, { _id: false });

/* ── Backup: channel entry ── */
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

/* ── Backup entry ── */
const backupEntrySchema = new Schema({
  id:          { type: String, required: true },
  createdAt:   { type: Number, required: true },
  incremental: { type: Boolean, default: false },
  guildName:   { type: String, default: "" },
  roles:       { type: [backupRoleSchema],     default: [] },
  categories:  { type: [backupCategorySchema], default: [] },
  channels:    { type: [backupChannelSchema],  default: [] }
}, { _id: false });

/* ── Security root ── */
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
  emergency:  { type: emergencySchema,  default: () => ({}) },
  monitoring: { type: monitoringSchema, default: () => ({}) },
  activity:   { type: activitySchema,   default: () => ({}) },
  backups:    { type: [backupEntrySchema], default: [] }
}, { _id: false });

/* ─────────────────────────────────────────────
   OUTROS SUB-SCHEMAS (inalterados)
   ───────────────────────────────────────────── */

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

/**
 * Opção do Select Menu Hub — CONFIGURAÇÃO EMBUTIDA.
 *
 * Em vez de referenciar outro panelId (que exigia criar um segundo
 * painel inteiro só para configurar uma opção do select), cada
 * opção carrega sua PRÓPRIA configuração de:
 *   - staff (cargos que veem o ticket desta opção)
 *   - nome do ticket (template)
 *   - modal personalizado
 *   - formulário sequencial
 *   - embed de boas-vindas (mostrada dentro do ticket criado)
 *
 * Categoria, canal de envio e tipo de criação (canal/thread) NÃO
 * são configuráveis por opção — esses continuam vindo do painel
 * raiz, já que todo o select hub é enviado num único canal.
 */
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

/**
 * Mensagens personalizáveis do ticket — substitui os textos
 * hardcoded espalhados pelo sistema. Cada campo aceita as variáveis
 * {user} (menção), {id} (ID do usuário) e {count} (número do ticket)
 * onde fizer sentido. Campos vazios/null caem no texto padrão.
 */
const ticketMensagensConfigSchema = new Schema({
  // Embed mostrada dentro do canal/thread recém-criado
  ticketCriadoTitulo:    { type: String, default: null }, // padrão: "🎫 Ticket Criado"
  ticketCriadoDescricao: { type: String, default: null }, // padrão: mensagem atual

  // Botão de fechar e confirmação de fechamento
  fecharBotaoLabel:      { type: String, default: null }, // padrão: "Fechar Ticket"
  fechandoMensagem:      { type: String, default: null }, // padrão: "⛔ Ticket será fechado em 10 segundos..."

  // Modal personalizado (formulário por modal)
  modalRespostasTitulo:  { type: String, default: null }, // padrão: "📋 Respostas do Formulário"

  // Formulário sequencial (perguntas no chat)
  seqInicioTitulo:       { type: String, default: null }, // padrão: "📋 Formulário de Atendimento"
  seqInicioDescricao:    { type: String, default: null }, // padrão: mensagem atual (usa {user} e {timeout})
  seqCanceladoMensagem:  { type: String, default: null }, // padrão: "⚠️ Formulário encerrado."
  seqResumoTitulo:       { type: String, default: null }, // padrão: "✅ Respostas Recebidas"

  // Transcript
  transcriptTitulo:      { type: String, default: null }, // padrão: "📄 Transcript"
  transcriptDmTitulo:    { type: String, default: null }, // padrão: "📄 Seu Transcript"
  transcriptDmDescricao: { type: String, default: null }, // padrão: mensagem atual
}, { _id: false });

const ticketSchema = new Schema({
  panelId:         { type: String, required: true },
  categoriaId:     { type: String, default: null  },
  canalId:         { type: String, default: null  },
  painelPrincipal: { type: Object, default: null  },
  cargosStaff:     { type: [String], default: []  },
  ticketChatName:  { type: String, default: null  },
  contadorTicket:  { type: Number, default: 0     },
  tipoDeCriacao:   { type: Number, enum: [0, 1, 2], default: 0 },
  modalConfig:         { type: modalConfigSchema,        default: () => ({}) },
  autoRoleConfig:      { type: autoRoleConfigSchema,     default: () => ({}) },
  seqQuestionsConfig:  { type: seqQuestionsConfigSchema, default: () => ({}) },
  transcriptConfig:    { type: transcriptConfigSchema,   default: () => ({}) },
  selectMenuConfig:    { type: selectMenuConfigSchema,   default: () => ({}) },
  mensagensConfig:     { type: ticketMensagensConfigSchema, default: () => ({}) }
}, { _id: false });

/* ─────────────────────────────────────────────
   CARGOS TEMPORÁRIOS / VINCULADOS
   ───────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────
   GUILD SCHEMA PRINCIPAL
   ───────────────────────────────────────────── */

const guildSchema = new Schema({
  guildId:     { type: String, required: true, unique: true },
  premiumUser: { type: String, default: "0" },
  premiumTime: { type: Number, default: 0   },
  premiumPlan: { type: String, default: null }, // seção 2: nova_estrela | lua_crescente | constellation
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

  security: { type: securitySchema, default: () => ({}) }
});

/* ─────────────────────────────────────────────
   EXPORTS
   ───────────────────────────────────────────── */

const GuildModel            = model("Guild",     guildSchema);
const PendingTempRoleModel  = model("PendingTempRole",  pendingTempRoleSchema);
const ActiveLinkedRoleModel = model("ActiveLinkedRole", activeLinkedRoleSchema);

module.exports = {
  GuildDb: GuildModel,
  PendingTempRoleModel,
  ActiveLinkedRoleModel
};
