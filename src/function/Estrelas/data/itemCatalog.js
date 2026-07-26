'use strict';

const RECURSOS   = require('./recursos.js');
const SEMENTES   = require('./sementes.js');
const RECEITAS   = require('./receitas.js');
const CONSTRUCOES = require('./construcoes.js');

const RARO_RECURSOS = new Set(['cristais', 'reliquias', 'poeiraEstelar']);

const MATERIAIS_BASE = new Set(['tabua_madeira', 'lingote_ferro', 'po_de_cristal']);

function buildRecursoDef(def) {
  return {
    id: def.id,
    nome: def.nome,
    emoji: def.emoji || '📦',
    categoria: 'Recursos',
    raridade: RARO_RECURSOS.has(def.id) ? 'Raro' : 'Comum',
    origem: 'Exploração, Jardim e Companheiros',
    descricao: `Recurso bruto usado em receitas da Oficina, plantio no Jardim e construções.`
  };
}

function buildSementeDef(def) {
  return {
    id: def.id,
    nome: def.nome,
    emoji: def.emoji || '🌱',
    categoria: 'Sementes',
    raridade: 'Comum',
    origem: 'Jardim',
    descricao: `Leva ${def.tempoMinutos} min para crescer. Ao colher: ${Object.entries(def.colheita || {})
      .map(([r, q]) => `${q}x ${RECURSOS[r]?.nome ?? r}`)
      .join(', ') || 'nenhum recurso definido'}.`
  };
}

function buildReceitaDef(def) {
  const eBase = MATERIAIS_BASE.has(def.id);
  return {
    id: def.id,
    nome: def.nome,
    emoji: '🛠️',
    categoria: eBase ? 'Materiais' : 'Itens fabricados',
    raridade: eBase ? 'Comum' : 'Incomum',
    origem: 'Oficina',
    descricao: `Fabricado na Oficina a partir de ${Object.entries(def.custoRecursos || {})
      .map(([r, q]) => `${q}x ${RECURSOS[r]?.nome ?? r}`)
      .join(', ') || 'nenhum recurso'}${def.custoEstrelas ? ` e ${def.custoEstrelas} Estrelas` : ''}.`
  };
}

function buildDecoracaoDef(def) {
  return {
    id: def.id,
    nome: def.nome,
    emoji: def.emoji || '🎀',
    categoria: 'Decorações',
    raridade: 'Incomum',
    origem: 'Jardim e Mercado',
    descricao: `Decoração para o Jardim, sem efeito mecânico direto.`
  };
}

const CATALOGO = {};

for (const def of Object.values(RECURSOS)) CATALOGO[def.id] = buildRecursoDef(def);
for (const def of Object.values(SEMENTES)) CATALOGO[def.id] = buildSementeDef(def);
for (const def of Object.values(RECEITAS)) CATALOGO[def.id] = buildReceitaDef(def);
for (const def of Object.values(CONSTRUCOES.decoracoes || {})) CATALOGO[def.id] = buildDecoracaoDef(def);

function getItemDef(itemId) {
  return CATALOGO[itemId] ?? {
    id: itemId,
    nome: itemId,
    emoji: '❔',
    categoria: 'Itens especiais',
    raridade: 'Especial',
    origem: 'Missões, Eventos ou Biblioteca',
    descricao: 'Item especial obtido por uma fonte específica da Ayami.'
  };
}

const CATEGORIAS = [
  { id: 'recursos',   nome: 'Recursos',         emoji: '🪵' },
  { id: 'materiais',  nome: 'Materiais',        emoji: '🧱' },
  { id: 'sementes',   nome: 'Sementes',         emoji: '🌱' },
  { id: 'plantas',    nome: 'Plantas',          emoji: '🌷' },
  { id: 'fabricados', nome: 'Itens fabricados', emoji: '🛠️' },
  { id: 'decoracoes', nome: 'Decorações',       emoji: '🎀' },
  { id: 'especiais',  nome: 'Itens especiais',  emoji: '✨' }
];

const CATEGORIA_PARA_ID = {
  'Recursos': 'recursos',
  'Materiais': 'materiais',
  'Sementes': 'sementes',
  'Plantas': 'plantas',
  'Itens fabricados': 'fabricados',
  'Decorações': 'decoracoes',
  'Itens especiais': 'especiais'
};

module.exports = { CATALOGO, getItemDef, CATEGORIAS, CATEGORIA_PARA_ID };
