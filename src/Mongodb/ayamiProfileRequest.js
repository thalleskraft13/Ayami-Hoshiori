'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Perfil Personalizado da Ayami por Servidor — Constellation.
 *
 * ⚠️ ARQUIVO ESPELHADO ENTRE BOT E SITE (mesmo padrão do PremiumPlans.js).
 * Existe idêntico em:
 *   - Ayami/src/Mongodb/ayamiProfileRequest.js        (bot)
 *   - ayami-fixed/models/ayamiProfileRequest.js        (site/dashboard)
 *
 * O site cria o documento (status "pending") e envia a mensagem de
 * aprovação diretamente via bot token (services/discordSender.js
 * → sendAsBot). O bot só entra em cena quando alguém clica em
 * Aprovar/Recusar (interação chega via Gateway, sempre no processo
 * do bot) — dali em diante quem aplica as mudanças e edita o
 * documento é o bot (AyamiProfileManager).
 *
 * Campos de banner/bio ficam prontos na arquitetura mas OCULTOS na UI
 * do dashboard: a API do Discord não permite avatar de bot diferente
 * por servidor... na verdade permite (member avatar per-guild), mas
 * NÃO permite banner nem "sobre mim" (about me) por servidor — só
 * globalmente via PATCH /users/@me. Assim que a Discord liberar,
 * basta destravar a opção no dashboard; o schema já está pronto.
 */
const ayamiProfileRequestSchema = new Schema({
  // ── Servidor ──
  guildId:   { type: String, required: true, index: true },
  guildName: { type: String, default: null },
  guildIcon: { type: String, default: null }, // hash do ícone (não URL pronta)

  // ── Dono do servidor ──
  ownerId:   { type: String, default: null },
  ownerName: { type: String, default: null },

  // ── Administrador que fez a solicitação ──
  requesterId:   { type: String, required: true },
  requesterName: { type: String, default: null },

  // ── Alterações solicitadas ──
  changes: {
    avatar: {
      requested: { type: Boolean, default: false },
      url:       { type: String, default: null }, // imagem já normalizada (hospedada) pronta pra aplicar
      previousUrl: { type: String, default: null }, // avatar atual no momento da solicitação (pra exibir no diff)
    },
    banner: {
      requested: { type: Boolean, default: false },
      url:       { type: String, default: null },
      previousUrl: { type: String, default: null },
    },
    bio: {
      requested: { type: Boolean, default: false },
      text:       { type: String, default: null },
      previousText: { type: String, default: null },
    },
  },

  reason: { type: String, default: null }, // motivo opcional informado por quem solicitou

  // ── Estado da solicitação ──
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
    index: true,
  },

  // ── Mensagem de análise (pra editar depois de aprovar/recusar) ──
  reviewChannelId: { type: String, default: '1527960368251670628' },
  reviewMessageId: { type: String, default: null },

  // ── Canal do servidor solicitante pra enviar a notificação do resultado ──
  notifyChannelId: { type: String, default: null },

  // ── Resolução ──
  resolvedBy:     { type: String, default: null }, // userId de quem aprovou/recusou
  denialReason:   { type: String, default: null },
  appliedChanges: {
    avatar: { type: Boolean, default: false },
    banner: { type: Boolean, default: false },
    bio:    { type: Boolean, default: false },
  },

  resolvedAt: { type: Date, default: null },
}, {
  timestamps: true, // createdAt = data da solicitação
  collection: 'ayami_profile_requests',
});

ayamiProfileRequestSchema.index({ guildId: 1, status: 1 });
ayamiProfileRequestSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.models.AyamiProfileRequest
  || mongoose.model('AyamiProfileRequest', ayamiProfileRequestSchema);
