'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Comando personalizado de chat da Twitch, por servidor.
 *
 * Este model ESPELHA EXATAMENTE ayami-fixed/models/twitchCommand.js do
 * Dashboard — mesma `collection`, mesmos campos, mesmos índices. Não é
 * uma cópia de dados: é o MESMO documento Mongo, acessado por outro
 * processo, igual ao padrão já usado em twitchChannel, creatorMission,
 * etc. Qualquer alteração de schema precisa ser replicada nos dois
 * arquivos.
 *
 * Já genérico por `platform` (mesmo padrão de CreatorAccountLink e
 * CreatorMission) — preparado para YouTube/TikTok/Kick reaproveitarem
 * este MESMO model no futuro, sem model novo.
 *
 * Execução ao vivo (TwitchChatBot.js) NUNCA duplica esta definição —
 * apenas lê `trigger`/`response`/`cooldownSeconds`/`permission`/`active`
 * daqui pra decidir o que responder no chat.
 */

const PERMISSIONS = Object.freeze({
  EVERYONE:   'everyone',
  SUBSCRIBER: 'subscriber',
  VIP:        'vip',
  MODERATOR:  'moderator',
  BROADCASTER: 'broadcaster',
});

const twitchCommandSchema = new Schema({
  guildId:  { type: String, required: true, index: true },
  platform: { type: String, required: true, default: 'twitch', index: true },

  // Sempre em minúsculas, sem o prefixo "!" (o prefixo é responsabilidade
  // de quem digita no chat da Twitch; comparação já normaliza).
  trigger: { type: String, required: true, trim: true, lowercase: true },

  // Suporta variáveis: {user} {channel} {game} {titulo} {uptime} {url} {count}
  response: { type: String, required: true },

  cooldownSeconds: { type: Number, default: 10, min: 0 },
  permission: {
    type: String,
    enum: Object.values(PERMISSIONS),
    default: PERMISSIONS.EVERYONE,
  },

  active: { type: Boolean, default: true },

  usageCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: null },
  lastUsedBy: { type: String, default: null }, // login da Twitch de quem disparou por último

  createdBy: { type: String, default: null }, // discordUserId de quem criou (Bot ou Dashboard)
}, {
  timestamps: true,
  collection: 'twitch_chat_commands',
});

// Um mesmo gatilho não pode se repetir duas vezes no mesmo servidor/plataforma.
twitchCommandSchema.index({ guildId: 1, platform: 1, trigger: 1 }, { unique: true });

module.exports = mongoose.models.TwitchCommand
  || mongoose.model('TwitchCommand', twitchCommandSchema);

module.exports.PERMISSIONS = PERMISSIONS;
