'use strict';

/**
 * Catálogo estático dos planos Premium — seção 2 do prompt de implementação.
 *
 * Substitui o antigo modelo "premium flat" (um boolean só: tem ou não tem)
 * por 3 planos com limites diferentes. O preço por DURAÇÃO (mensal/
 * trimestral/semestral) continua existindo — é ortogonal ao PLANO, que
 * define o NÍVEL de benefícios.
 *
 * Mantém "Constellation" como o nome do topo de linha (já era a marca
 * usada em toda a UI existente — `/premium`, painel, embeds), com dois
 * planos novos abaixo dela.
 */
const BASE_FIVE_STAR_EXTRA_CHANCE = 2 / 20; // chance extra de quem NÃO tem premium (baseline já existente em Banners.js)

const PLANS = {
  nova_estrela: {
    id:              'nova_estrela',
    name:            'Nova Estrela',
    emoji:           '🌟',
    order:           1,
    guildLimit:      1,     // quantos servidores a assinatura pode ativar
    dailyMultiplier: 1.25,  // bônus no /primogemas daily
    fiveStarExtraChance: 4 / 20, // chance de pull extra de 5⭐ (ver Banners.js#multi)
    ticketPriority:  false,
    webhookAccess:   false,
  },
  lua_crescente: {
    id:              'lua_crescente',
    name:            'Lua Crescente',
    emoji:           '🌙',
    order:           2,
    guildLimit:      3,
    dailyMultiplier: 1.6,
    fiveStarExtraChance: 5.5 / 20,
    ticketPriority:  true,
    webhookAccess:   false,
  },
  constellation: {
    id:              'constellation',
    name:            'Constellation',
    emoji:           '✨',
    order:           3,
    guildLimit:      5,
    dailyMultiplier: 2,
    fiveStarExtraChance: 7 / 20, // valor que já era usado pra "premium" antes da seção 2
    ticketPriority:  true,
    webhookAccess:   true,
  },
};

const DEFAULT_PLAN = 'constellation'; // fallback pra premium concedido antes da seção 2 existir (sem plano salvo)

function getPlan(planId) {
  return PLANS[planId] ?? PLANS[DEFAULT_PLAN];
}

function isValidPlan(planId) {
  return Object.prototype.hasOwnProperty.call(PLANS, planId);
}

module.exports = { PLANS, DEFAULT_PLAN, getPlan, isValidPlan, BASE_FIVE_STAR_EXTRA_CHANCE };
