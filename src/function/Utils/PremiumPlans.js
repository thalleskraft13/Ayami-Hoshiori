'use strict';


const PLAN_KEYS = {
  FREE:          'FREE',
  NOVA_ESTRELA:  'NOVA_ESTRELA',
  LUA_CRESCENTE: 'LUA_CRESCENTE',
  CONSTELLATION: 'CONSTELLATION',
};

const PLAN_RANK = {
  FREE:          0,
  NOVA_ESTRELA:  1,
  LUA_CRESCENTE: 2,
  CONSTELLATION: 3,
};

const DEFAULT_PLAN = PLAN_KEYS.CONSTELLATION;

const BASE_FIVE_STAR_EXTRA_CHANCE = 2 / 20;

const PLANS = {
  FREE: {
    key:   PLAN_KEYS.FREE,
    name:  'Gratuito',
    emoji: '🌑',
    order: PLAN_RANK.FREE,
    price: 0,
    priceLabel: 'Grátis',

    premiumGuildLimit: 0,
    guildLimit: 0, // alias (nome usado no bot)

    logicBuilderFlowLimit: 10,

    logicScriptFileLimit: 6,
    logicScript: {
      maxFunctionsPerFile: 15,
      httpAccess: false,
      webhookAccess: false,
      canRunFlowById: false,
      premiumEvents: false,
    },

    tickets: {
      maxQuestions: 5,
      advancedTypeLimit: 0, // seleção / múltipla escolha / checkbox / anexos / membro / cargo / canal
      modalEnabled: false,
    },

    premiumConfigAccess: false,
    advancedTickets: false,
    advancedSystems: false,

    bonusRewards: false,
    summonBonus: false,
    dailyBonusMultiplier: 1,
    dailyMultiplier: 1, // alias (nome usado em Primogemas.js/Banners.js)
    fiveStarExtraChance: BASE_FIVE_STAR_EXTRA_CHANCE,

    earlyAccess: false,
    canaryAccess: false,
  },

  NOVA_ESTRELA: {
    key:   PLAN_KEYS.NOVA_ESTRELA,
    name:  'Nova Estrela',
    emoji: '🌟',
    order: PLAN_RANK.NOVA_ESTRELA,
    price: 7.99,
    priceLabel: 'R$ 7,99',

    premiumGuildLimit: 1,
    guildLimit: 1,

    logicBuilderFlowLimit: 25,
    logicScriptFileLimit: 15,
    logicScript: {
      maxFunctionsPerFile: 40,
      httpAccess: false,   // "HTTP bloqueado" — seção 2
      webhookAccess: false, // "Webhooks bloqueados" — seção 2
      canRunFlowById: false,
      premiumEvents: true, // primeiro plano pago já libera ticketUpdate/activitySpike/abrirTicket()
    },

    tickets: {
      maxQuestions: 10,
      advancedTypeLimit: 2,
      modalEnabled: true,
    },

    premiumConfigAccess: true,
    advancedTickets: true,
    advancedSystems: true,

    bonusRewards: false,
    summonBonus: false,
    dailyBonusMultiplier: 1.25,
    dailyMultiplier: 1.25, // alias (nome usado em Primogemas.js/Banners.js)
    fiveStarExtraChance: 4 / 20,

    earlyAccess: false,
    canaryAccess: false,
  },

  LUA_CRESCENTE: {
    key:   PLAN_KEYS.LUA_CRESCENTE,
    name:  'Lua Crescente',
    emoji: '🌙',
    order: PLAN_RANK.LUA_CRESCENTE,
    price: 14.99,
    priceLabel: 'R$ 14,99',

    premiumGuildLimit: 3,
    guildLimit: 3,

    logicBuilderFlowLimit: 35,
    logicScriptFileLimit: 35,
    logicScript: {
      maxFunctionsPerFile: Infinity,
      httpAccess: true,    // "HTTP liberado"
      webhookAccess: true, // "Webhooks liberados" (personalizados)
      canRunFlowById: true,
    },

    tickets: {
      maxQuestions: Infinity,
      advancedTypeLimit: Infinity,
      modalEnabled: true,
    },

    premiumConfigAccess: true,
    advancedTickets: true,
    advancedSystems: true,

    bonusRewards: true,
    summonBonus: true,
    dailyBonusMultiplier: 1.6,
    dailyMultiplier: 1.6, // alias (nome usado em Primogemas.js/Banners.js)
    fiveStarExtraChance: 5.5 / 20,

    earlyAccess: false,
    canaryAccess: false,
  },

  CONSTELLATION: {
    key:   PLAN_KEYS.CONSTELLATION,
    name:  'Constellation',
    emoji: '✨',
    order: PLAN_RANK.CONSTELLATION,
    price: 24.99,
    priceLabel: 'R$ 24,99',

    premiumGuildLimit: Infinity,
    guildLimit: Infinity,

    logicBuilderFlowLimit: Infinity,
    logicScriptFileLimit: Infinity,
    logicScript: {
      maxFunctionsPerFile: Infinity,
      httpAccess: true,
      webhookAccess: true,
      canRunFlowById: true,
    },

    tickets: {
      maxQuestions: Infinity,
      advancedTypeLimit: Infinity,
      modalEnabled: true,
    },

    premiumConfigAccess: true,
    advancedTickets: true,
    advancedSystems: true,

    bonusRewards: true,
    summonBonus: true,
    dailyBonusMultiplier: 2,
    dailyMultiplier: 2, // alias (nome usado em Primogemas.js/Banners.js)
    fiveStarExtraChance: 7 / 20,

    earlyAccess: true,
    canaryAccess: true,
  },
};

function normalizePlanKey(value) {
  if (!value) return PLAN_KEYS.FREE;
  const upper = String(value).trim().toUpperCase().replace(/[\s-]+/g, '_');

  const aliases = {
    'FREE': PLAN_KEYS.FREE,
    'GRATUITO': PLAN_KEYS.FREE,

    'NOVA_ESTRELA': PLAN_KEYS.NOVA_ESTRELA,
    'NOVAESTRELA': PLAN_KEYS.NOVA_ESTRELA,

    'LUA_CRESCENTE': PLAN_KEYS.LUA_CRESCENTE,
    'LUACRESCENTE': PLAN_KEYS.LUA_CRESCENTE,

    'CONSTELLATION': PLAN_KEYS.CONSTELLATION,
    'CONSTELACAO': PLAN_KEYS.CONSTELLATION,
  };

  return aliases[upper] || PLAN_KEYS.FREE;
}

function getPlan(planKey) {
  return PLANS[normalizePlanKey(planKey)] || PLANS.FREE;
}

function isValidPlan(planKey) {
  if (!planKey) return false;
  return normalizePlanKey(planKey) !== PLAN_KEYS.FREE || String(planKey).trim().toUpperCase() === PLAN_KEYS.FREE;
}

function isPlanAtLeast(planKey, otherPlanKey) {
  return PLAN_RANK[normalizePlanKey(planKey)] >= PLAN_RANK[normalizePlanKey(otherPlanKey)];
}

function resolveActivePlan(doc) {
  if (!doc) return PLAN_KEYS.FREE;

  const now = Date.now();

  const legacyExpire = doc.premiumTime ?? doc.premium;
  const legacyActive = legacyExpire === 1 || (typeof legacyExpire === 'number' && legacyExpire > now);

  const declaredPlan = normalizePlanKey(doc.premiumPlan);

  if (declaredPlan === PLAN_KEYS.FREE && legacyActive) {
    return DEFAULT_PLAN;
  }

  if (declaredPlan === PLAN_KEYS.FREE) return PLAN_KEYS.FREE;

  const expiresAt = doc.premiumExpiresAt ?? doc.premiumTime ?? doc.premium;
  const active = expiresAt === 1 || (typeof expiresAt === 'number' && expiresAt > now);

  return active ? declaredPlan : PLAN_KEYS.FREE;
}

module.exports = {
  PLAN_KEYS,
  PLAN_RANK,
  PLANS,
  DEFAULT_PLAN,
  BASE_FIVE_STAR_EXTRA_CHANCE,
  normalizePlanKey,
  getPlan,
  isValidPlan,
  isPlanAtLeast,
  resolveActivePlan,
};
