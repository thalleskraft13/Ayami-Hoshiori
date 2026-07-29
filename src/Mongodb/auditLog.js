'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const auditLogSchema = new Schema({
  staffId: { type: String, required: true, index: true },
  comando: { type: String, required: true, index: true },
  acao: { type: String, required: true },
  alvo: { type: String, default: null, index: true },
  alvoTipo: { type: String, default: null },
  resultado: { type: String, enum: ['sucesso', 'falha'], default: 'sucesso' },
  detalhes: { type: String, default: null },
  valoresAnteriores: { type: Schema.Types.Mixed, default: null },
  valoresPosteriores: { type: Schema.Types.Mixed, default: null },
  usouTokenOficial: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
}, {
  collection: 'ajudante_audit_logs',
});

module.exports = mongoose.models.AjudanteAuditLog || mongoose.model('AjudanteAuditLog', auditLogSchema);
