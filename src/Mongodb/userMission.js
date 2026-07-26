'use strict';

const { Schema, model, models } = require('mongoose');

const missionItemSchema = new Schema({
  id:          { type: String, required: true },
  templateId:  { type: String, required: true },
  categoria:   { type: String, required: true },
  acao:        { type: String, required: true },
  titulo:      { type: String, required: true },
  descricao:   { type: String, required: true },
  dificuldade: { type: String, enum: ['facil', 'medio', 'dificil', 'epico'], default: 'facil' },
  objetivo:    { type: Number, required: true },
  progresso:   { type: Number, default: 0 },
  recompensas: {
    estrelas: { type: Number, default: 0 }
  },
  concluida: { type: Boolean, default: false },
  resgatada: { type: Boolean, default: false }
}, { _id: false });

const grupoMissaoSchema = new Schema({
  generatedAt: { type: Number, default: 0 },
  expiresAt:   { type: Number, default: 0 },
  list:        { type: [missionItemSchema], default: [] }
}, { _id: false });

const userMissionSchema = new Schema({
  userId:  { type: String, required: true },
  guildId: { type: String, required: true },

  diaria:  { type: grupoMissaoSchema, default: () => ({}) },
  semanal: { type: grupoMissaoSchema, default: () => ({}) },
  mensal:  { type: grupoMissaoSchema, default: () => ({}) },

  createdAt: { type: Date, default: Date.now }
});

userMissionSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = models.UserMission || model('UserMission', userMissionSchema);
