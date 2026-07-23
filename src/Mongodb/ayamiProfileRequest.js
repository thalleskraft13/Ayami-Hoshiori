'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ayamiProfileRequestSchema = new Schema({
  guildId:   { type: String, required: true, index: true },
  guildName: { type: String, default: null },
  guildIcon: { type: String, default: null }, // hash do ícone (não URL pronta)

  ownerId:   { type: String, default: null },
  ownerName: { type: String, default: null },

  requesterId:   { type: String, required: true },
  requesterName: { type: String, default: null },

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

  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending',
    index: true,
  },

  reviewChannelId: { type: String, default: '1527960368251670628' },
  reviewMessageId: { type: String, default: null },

  notifyChannelId: { type: String, default: null },

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
