'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Alerta de evento da Twitch (Follow/Subscribe/Resub/GiftSub/Bits/Raid),
 * por servidor.
 *
 * Este model ESPELHA EXATAMENTE ayami-fixed/models/twitchAlert.js do
 * Dashboard — mesma `collection`, mesmos campos, mesmos índices. Não é
 * uma cópia de dados: é o MESMO documento Mongo, acessado por outro
 * processo, igual ao padrão já usado em twitchChannel, twitchCommand,
 * etc. Qualquer alteração de schema precisa ser replicada nos dois
 * arquivos.
 *
 * Já genérico por `platform` (mesmo padrão de CreatorAccountLink e
 * CreatorMission) — preparado para YouTube/TikTok/Kick reaproveitarem
 * este MESMO model no futuro, sem model novo.
 *
 * Diferente de `twitch_chat_commands` (gatilho único por servidor),
 * aqui é permitido mais de um alerta ativo para o MESMO `type` no mesmo
 * servidor (ex.: dois alertas de Bits com limiares diferentes) — por
 * isso o índice abaixo não é único, só de consulta.
 *
 * Quem dispara de verdade o alerta é o Bot:
 *   - Sub/Resub/GiftSub/Bits/Raid: eventos nativos do tmi.js na mesma
 *     conexão de `Twitch/Commands/TwitchChatBot.js`.
 *   - Follow: polling periódico da Helix "Get Channel Followers", ver
 *     `Twitch/Alerts/TwitchAlertService.js` e `TwitchApiService.js`.
 * A Dashboard só administra estes documentos (CRUD), nunca dispara um
 * alerta sozinha.
 */

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

// Mensagem padrão usada quando o alerta é criado sem uma mensagem
// customizada — mesmas variáveis suportadas por `renderMessage`.
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

  // Canal do Discord onde o alerta é publicado (obrigatório).
  discordChannelId: { type: String, required: true },

  // Cargo do Discord atribuído (opcional) a quem disparou o evento —
  // só é atribuído se existir CreatorAccountLink (Discord ↔ Twitch)
  // conectado para o autor do evento; nunca bloqueia o envio da
  // mensagem se não houver vínculo.
  roleId: { type: String, default: null },

  // Suporta variáveis: {user} {channel} {months} {tier} {bits} {viewers} {count}
  message: { type: String, required: true },

  // Limiar mínimo, quando aplicável ao tipo:
  //   bits    -> quantidade mínima de bits
  //   raid    -> quantidade mínima de viewers
  //   giftsub -> quantidade mínima de inscrições presenteadas de uma vez
  // Ignorado para follow/subscribe/resub.
  minAmount: { type: Number, default: null, min: 0 },

  usageCount:      { type: Number, default: 0 },
  lastTriggeredAt: { type: Date, default: null },

  createdBy: { type: String, default: null }, // discordUserId de quem criou (Bot ou Dashboard)
}, {
  timestamps: true,
  collection: 'twitch_alerts',
});

// Não-único (ao contrário de twitch_chat_commands) — vários alertas do
// mesmo tipo podem coexistir no mesmo servidor (ex.: limiares diferentes).
twitchAlertSchema.index({ guildId: 1, platform: 1, type: 1 });

module.exports = mongoose.models.TwitchAlert
  || mongoose.model('TwitchAlert', twitchAlertSchema);

module.exports.TYPES = TYPES;
module.exports.TYPE_LABELS = TYPE_LABELS;
module.exports.DEFAULT_MESSAGES = DEFAULT_MESSAGES;
