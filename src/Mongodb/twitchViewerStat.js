'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Estatísticas de um espectador da Twitch dentro de UM servidor
 * (guildId) — tempo assistido, mensagens, lives acompanhadas.
 *
 * Este model ESPELHA EXATAMENTE ayami-fixed/models/twitchViewerStat.js
 * do Dashboard — mesma `collection`, mesmos campos, mesmos índices.
 * Não é uma cópia de dados: é o MESMO documento Mongo, acessado por
 * outro processo, igual ao padrão do resto do módulo.
 *
 * Por que por servidor (e não global, como `CreatorAccountLink.stats`):
 * o mesmo espectador pode acompanhar canais diferentes em servidores
 * diferentes, e o ranking/ "espectadores" da doc é sempre por
 * servidor. `CreatorAccountLink.stats` continua reservado para um
 * rollup GLOBAL futuro (perfil do usuário) — este model aqui é o dado
 * de origem por servidor, granular.
 *
 * Identificação sempre por `viewerTwitchId` (ID oficial da Twitch),
 * nunca por login/nome — vínculo com Discord é resolvido em tempo de
 * leitura via `CreatorAccountLink` (platform=twitch, platformUserId=
 * viewerTwitchId), nunca duplicado aqui.
 *
 * Escrita feita inteiramente por Twitch/Commands/TwitchChatBot.js
 * (conta dedicada "AyamiBot", já conectada ao chat pra Fase 6):
 *   - `messageCount` incrementado a cada mensagem vista no chat.
 *   - `watchSeconds`/`livesWatched` incrementados por amostragem
 *     periódica via Helix "Get Chatters" (token da própria AyamiBot,
 *     escopo `moderator:read:chatters`, exige a AyamiBot ser
 *     moderadora do canal — mesmo requisito já documentado na Fase 6).
 */

const twitchViewerStatSchema = new Schema({
  guildId:  { type: String, required: true, index: true },
  platform: { type: String, required: true, default: 'twitch', index: true },

  viewerTwitchId:    { type: String, required: true },
  viewerLogin:       { type: String, default: null }, // cache de exibição, nunca chave
  viewerDisplayName: { type: String, default: null },

  messageCount: { type: Number, default: 0 },
  watchSeconds: { type: Number, default: 0 },
  livesWatched: { type: Number, default: 0 },

  // Evita contar a mesma live duas vezes em `livesWatched` entre
  // amostragens sucessivas (persistido, não em memória, pra
  // sobreviver a reinícios do Bot).
  lastCountedStreamId: { type: String, default: null },

  lastSeenAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'twitch_viewer_stats',
});

twitchViewerStatSchema.index({ guildId: 1, platform: 1, viewerTwitchId: 1 }, { unique: true });
// Suporta o ranking (ordenar por tempo assistido dentro de um servidor).
twitchViewerStatSchema.index({ guildId: 1, watchSeconds: -1 });

module.exports = mongoose.models.TwitchViewerStat
  || mongoose.model('TwitchViewerStat', twitchViewerStatSchema);
