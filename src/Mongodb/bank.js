'use strict';

const { Schema, model } = require("mongoose");

const moedaSchema = new Schema({
  nome:           { type: String, default: 'Coins' },
  simbolo:        { type: String, default: '🪙' },
  cor:            { type: String, default: '#F5C542' },
  icone:          { type: String, default: null },
  taxaConversao:  { type: Number, default: 1 },
  casasDecimais:  { type: Number, default: 0 }
}, { _id: false });

const configuracoesGeraisSchema = new Schema({
  ativa:               { type: Boolean, default: true },
  nomePublico:         { type: String, default: null },
  logs:                { type: Boolean, default: false },
  canalLogsId:         { type: String, default: null },
  confirmacoes:        { type: Boolean, default: true },
  limiteTransferencia: { type: Number, default: null }
}, { _id: false });

const permissoesSchema = new Schema({
  cargosAutorizados: { type: [String], default: [] }
}, { _id: false });

const salarioSchema = new Schema({
  cargoId:           { type: String, required: true },
  valor:             { type: Number, default: 0 },
  intervaloMinutos:  { type: Number, default: 1440 },
  limite:            { type: Number, default: null },
  ativo:             { type: Boolean, default: true },
  ultimoPagamentoEm: { type: Number, default: null }
}, { _id: false });

const impostosSchema = new Schema({
  transferencias: { type: Number, default: 0 },
  compras:        { type: Number, default: 0 },
  vendas:         { type: Number, default: 0 },
  mercado:        { type: Number, default: 0 },
  loja:           { type: Number, default: 0 },
  leiloes:        { type: Number, default: 0 },
  trocas:         { type: Number, default: 0 }
}, { _id: false });

const recompensaSchema = new Schema({
  tipo:              { type: String, required: true },
  valor:             { type: Number, default: 0 },
  cooldownSegundos:  { type: Number, default: 0 },
  limiteDiario:      { type: Number, default: null },
  cargoObrigatorio:  { type: String, default: null },
  cargoBloqueado:    { type: String, default: null },
  canalPermitido:    { type: String, default: null },
  canalBloqueado:    { type: String, default: null },
  ativo:             { type: Boolean, default: true }
}, { _id: false });

const configuracoesSchema = new Schema({
  permitirLogicEngine: { type: Boolean, default: true },
  permitirLogicScript: { type: Boolean, default: true }
}, { _id: false });

const bankSchema = new Schema({
  guildId:          { type: String, required: true, unique: true, index: true },

  nome:             { type: String, default: 'Banco do Servidor' },
  icone:            { type: String, default: null },
  descricao:        { type: String, default: '' },

  saldoEstrelas:    { type: Number, default: 0 },
  totalEmitido:     { type: Number, default: 0 },
  tesouraria:       { type: Number, default: 0 },

  moeda:            { type: moedaSchema, default: () => ({}) },
  configuracoes:    { type: configuracoesSchema, default: () => ({}) },
  configuracoesGerais: { type: configuracoesGeraisSchema, default: () => ({}) },
  permissoes:       { type: permissoesSchema, default: () => ({}) },
  salarios:         { type: [salarioSchema], default: [] },
  impostos:         { type: impostosSchema, default: () => ({}) },
  recompensas:      { type: [recompensaSchema], default: [] },
  administradores:  { type: [String], default: [] },

  criadoPor:        { type: String, default: null },
  criadoEm:         { type: Number, default: Date.now }
}, {
  collection: 'server_banks'
});

module.exports = model('ServerBank', bankSchema);
