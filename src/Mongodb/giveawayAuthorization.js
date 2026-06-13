'use strict';

const mongoose = require('mongoose');

/**
 * Armazena autorizações entre servidores para o sistema de sorteios.
 *
 * Quando o servidor A quer usar dados do servidor B, o dono/admin do B
 * deve autorizar. Esta coleção registra o estado dessa autorização.
 */
const AuthorizationSchema = new mongoose.Schema({

  /* servidor que CONCEDE a autorização */
  ownerGuildId: { type: String, required: true },

  /* servidor que RECEBEU a autorização */
  requesterGuildId: { type: String, required: true },

  /* dono do servidor que concede (único que pode aprovar) */
  ownerId: { type: String, default: null },

  /* quem aprovou (userId do dono) */
  approvedBy: { type: String, default: null },

  /* como a solicitação foi enviada: 'dm' | 'channel' */
  sentVia: { type: String, default: null },

  /* tipo de permissão concedida */
  permissionLevel: {
    type: String,
    enum: ['basic', 'advanced', 'multi_giveaway'],
    default: 'basic',
  },
  /*
    basic         → verificar se o usuário está no servidor
    advanced      → cargos, atividade, níveis, permanência, estatísticas
    multi_giveaway → participação em sorteios compartilhados
  */

  /* estado da solicitação */
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'revoked'],
    default: 'pending',
  },

  /* mensagem de autorização enviada (para editar depois) */
  authMessageId:  { type: String, default: null },
  authChannelId:  { type: String, default: null },

  /* validade (null = sem expiração) */
  expiresAt: { type: Date, default: null },

  requestedAt: { type: Date, default: Date.now },
  resolvedAt:  { type: Date, default: null },

}, {
  timestamps: true,
  collection: 'giveaway_authorizations',
});

AuthorizationSchema.index({ ownerGuildId: 1, requesterGuildId: 1 }, { unique: true });
AuthorizationSchema.index({ status: 1 });

module.exports = mongoose.models.GiveawayAuthorization
  || mongoose.model('GiveawayAuthorization', AuthorizationSchema);
