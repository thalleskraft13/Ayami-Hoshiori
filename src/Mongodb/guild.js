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
  list:            { type: [String], default: [] },
  // ID da regra nativa de AutoMod do Discord que espelha esta config (ver NativeAutoMod.js)
  nativeRuleId:    { type: String, default: null }
}, { _id: false });

/* ── Antispam extends simple ── */
const antispamSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  // maxMessages/intervalSeconds ficam guardados por compatibilidade, mas a
  // detecção real passou a ser a heurística nativa do Discord AutoMod
  // (trigger_type SPAM), que não aceita threshold customizado.
  maxMessages:     { type: Number, default: 5 },
  intervalSeconds: { type: Number, default: 5 },
  nativeRuleId:    { type: String, default: null }
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
  blockedDomains:  { type: [String], default: [] },
  blockInvites:    { type: Boolean, default: false },
  nativeRuleId:    { type: String, default: null },
  invitesRuleId:   { type: String, default: null }
}, { _id: false });

/* ── Antimention extends simple ── */
const antimentionSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  maxMentions:     { type: Number, default: 5 },
  nativeRuleId:    { type: String, default: null }
}, { _id: false });

/* ── Antiemoji extends simple (sem equivalente nativo no Discord AutoMod) ── */
const antiemojiSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  maxEmojis:       { type: Number, default: 10 }
}, { _id: false });

/* ── Antifiles extends simple (sem equivalente nativo no Discord AutoMod) ── */
const antifilesSchema = new Schema({
  enabled:         { type: Boolean, default: false },
  actions:         { type: [String], default: ["delete"] },
  escalation:      { type: [escalationLevelSchema], default: [] },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  // Extensões bloqueadas, sem o ponto. Ex: ["exe", "bat", "scr"]
  blockedExtensions: { type: [String], default: ["exe", "bat", "scr", "cmd", "msi", "vbs", "jar"] }
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
  antimention: { type: antimentionSchema, default: () => ({}) },
  antiemoji:   { type: antiemojiSchema,   default: () => ({}) },
  antifiles:   { type: antifilesSchema,   default: () => ({}) }
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

/* ── Raid history entry ──
   `factors` guarda o detalhamento de QUAIS sinais contribuíram para a
   detecção (nunca um só) — ex: [{ key: "joinRate", score: 82, detail: "14 joins/min" }, ...] */
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

/* ── AntiRaid Inteligente — cada fator é independente e configurável.
   O risco final é uma combinação ponderada de todos os fatores ativos;
   a Ayami nunca aciona a resposta de raid com base em um único fator
   isolado (ver RaidIntelligence.js). ── */
const raidFactorJoinRateSchema = new Schema({
  enabled:  { type: Boolean, default: true },
  joinLimit:{ type: Number,  default: 10 }   // joins/min considerados "muitos"
}, { _id: false });

const raidFactorNewAccountsSchema = new Schema({
  enabled:      { type: Boolean, default: true },
  maxAgeHours:  { type: Number,  default: 24 },  // conta é "recém-criada" se mais nova que isso
  ratioPercent: { type: Number,  default: 50 }   // % dos joins recentes que precisa ser conta nova
}, { _id: false });

const raidFactorDuplicateMessagesSchema = new Schema({
  enabled:  { type: Boolean, default: true },
  minCount: { type: Number,  default: 5 }  // mensagens ~idênticas de usuários diferentes, na janela
}, { _id: false });

const raidFactorCoordinatedSpamSchema = new Schema({
  enabled:   { type: Boolean, default: true },
  minUsers:  { type: Number,  default: 6 },   // usuários distintos mandando mensagens no mesmo burst
  windowSec: { type: Number,  default: 10 }
}, { _id: false });

const raidFactorMassMentionsSchema = new Schema({
  enabled:  { type: Boolean, default: true },
  minCount: { type: Number,  default: 15 }  // total de menções na janela recente, entre vários usuários
}, { _id: false });

const raidFactorMassInvitesSchema = new Schema({
  enabled:  { type: Boolean, default: true },
  minCount: { type: Number,  default: 4 }   // convites postados na janela, por usuários diferentes
}, { _id: false });

const raidFactorsSchema = new Schema({
  joinRate:           { type: raidFactorJoinRateSchema,           default: () => ({}) },
  newAccounts:        { type: raidFactorNewAccountsSchema,        default: () => ({}) },
  duplicateMessages:  { type: raidFactorDuplicateMessagesSchema,  default: () => ({}) },
  coordinatedSpam:    { type: raidFactorCoordinatedSpamSchema,    default: () => ({}) },
  massMentions:       { type: raidFactorMassMentionsSchema,       default: () => ({}) },
  massInvites:        { type: raidFactorMassInvitesSchema,        default: () => ({}) }
}, { _id: false });

/* ── Raid detection (AntiRaid Inteligente) ── */
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
  // estado runtime persistido (sobrevive a restart do bot)
  state: {
    emergencyActive: { type: Boolean, default: false },
    lastHighRiskAt:  { type: Number,  default: null },
    flaggedUserIds:  { type: [String], default: [] } // quem entrou durante o pico de risco (p/ punição em lote)
  }
}, { _id: false });

// ⚠️ "Verificação de Atividade" (ranking/history/deadChannels/etc) foi
// removida daqui — deixou de ser parte de Segurança e virou o módulo
// independente Análise de Atividade (ver Mongodb/activity*.js e
// function/System/Activity/ActivityAnalyticsSystem.js). Documentos
// antigos no Mongo podem ainda ter um campo `security.activity`
// solto — ele simplesmente não é mais lido nem validado por este
// schema, e o Mongoose não reclama de campos extras não declarados.

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

/* ── Análise de Atividade (módulo independente — config apenas;
   os dados agregados ficam em coleções próprias, ver Mongodb/activity*.js) ── */
const activityAnalyticsSchema = new Schema({
  enabled:         { type: Boolean, default: true  },
  ignoreBots:      { type: Boolean, default: true  },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles:    { type: [String], default: [] },
  ignoredUsers:    { type: [String], default: [] },
}, { _id: false });

/* ── Verificação de Novos Membros ──
   `violations` no histórico sempre guarda EXATAMENTE quais regras foram
   violadas (nunca um veredito genérico de "suspeito"). ── */
const verificationViolationSchema = new Schema({
  key:   { type: String, required: true },  // minAccountAge | requireCustomAvatar
  label: { type: String, required: true }   // texto humano, ex: "Conta criada há 2h (mínimo: 48h)"
}, { _id: false });

const verificationHistorySchema = new Schema({
  timestamp:  { type: Number, required: true },
  userId:     { type: String, required: true },
  username:   { type: String, default: "" },
  violations: { type: [verificationViolationSchema], default: [] },
  action:     { type: String, required: true } // none | log | timeout | kick | ban | quarantine
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
  // "apenas registrar" (log_only) nunca pune, só documenta a violação;
  // "auto_punish" aplica o `punishment` configurado abaixo.
  mode:             { type: String,  default: "log_only" }, // log_only | auto_punish
  logSuspicious:    { type: Boolean, default: true },        // registra mesmo as violações no modo log_only
  punishment:       { type: String,  default: "none" },      // none | log | timeout | kick | ban | quarantine
  quarantineRoleId: { type: String,  default: null },
  history:          { type: [verificationHistorySchema], default: [] }
}, { _id: false });

/* ── Canal Armadilha ──
   Detecção isolada de self-bots/scripts: qualquer mensagem enviada no
   canal-armadilha configurado é tratada como violação, exceto para quem
   estiver na lista de exceções. Nunca apaga mensagens antigas — só a
   mensagem-gatilho no próprio canal armadilha e, opcionalmente,
   mensagens recentes (dentro da janela configurada) do mesmo autor em
   outros canais. Ver Security/TrapChannel.js. */
const trapChannelHistorySchema = new Schema({
  timestamp:        { type: Number, required: true },
  userId:           { type: String, required: true },
  username:         { type: String, default: "" },
  action:           { type: String, required: true }, // log | timeout | kick | ban
  deletedElsewhere: { type: Number, default: 0 }       // qtd. de mensagens extras apagadas em outros canais
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
  premiumPlan: { type: String, default: null }, // FREE | NOVA_ESTRELA | LUA_CRESCENTE | CONSTELLATION — veja function/Utils/PremiumPlans.js
  // ⚠️ Unificado com o site (site/models/guild.js, mesmo nome de campo).
  // Sem `enum` de propósito: documentos antigos podem ter valores legados
  // em minúsculo (ex.: "constellation") e a validação de mongoose recusaria
  // o save() de qualquer outro código que releia e regrave este documento
  // por um motivo não relacionado a premium. A normalização/validação real
  // acontece em PremiumPlans.js#normalizePlanKey, que aceita os dois formatos.
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

  // Módulo independente Análise de Atividade — só a config fica aqui;
  // os dados agregados (mensagens, ranking, tendências etc.) ficam em
  // coleções próprias (Mongodb/activity*.js), não neste documento.
  activityAnalytics: { type: activityAnalyticsSchema, default: () => ({}) }
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
