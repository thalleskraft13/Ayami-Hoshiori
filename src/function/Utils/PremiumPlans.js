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
    guildLimit: 0,

                    twitchAlertLimit: 2,

                        twitchMissionLimit: 2,

    logicBuilderFlowLimit: 10,

    logicScriptFileLimit: 6,
    logicScript: {
      maxFunctionsPerFile: 15,
      httpAccess: false,
      webhookAccess: false,
      canRunFlowById: false,
      premiumEvents: false,
    },

    endpoints: {
      enabled: false,
      maxEndpoints: 0,
      memoryBytes: 0,
      rateLimitPerMinute: 0,
      maxRequestBytes: 0,
      historyLimit: 0,
      errorLogs: false,
      ipWhitelist: false,
      advancedStats: false,
      priorityProcessing: false,
    },

    tickets: {
      maxQuestions: 5,
      advancedTypeLimit: 0,
      modalEnabled: false,
    },

    premiumConfigAccess: false,
    advancedTickets: false,
    advancedSystems: false,

    bonusRewards: false,
    summonBonus: false,
    dailyBonusMultiplier: 1,
    dailyMultiplier: 1,
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

    twitchAlertLimit: 6,
    twitchMissionLimit: 6,

    logicBuilderFlowLimit: 25,
    logicScriptFileLimit: 15,
    logicScript: {
      maxFunctionsPerFile: 40,
      httpAccess: false,
      webhookAccess: false,
      canRunFlowById: false,
      premiumEvents: true,
    },

    endpoints: {
      enabled: false,
      maxEndpoints: 0,
      memoryBytes: 0,
      rateLimitPerMinute: 0,
      maxRequestBytes: 0,
      historyLimit: 0,
      errorLogs: false,
      ipWhitelist: false,
      advancedStats: false,
      priorityProcessing: false,
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
    dailyMultiplier: 1.25,
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

    twitchAlertLimit: 10,
    twitchMissionLimit: 10,

    logicBuilderFlowLimit: 35,
    logicScriptFileLimit: 35,
    logicScript: {
      maxFunctionsPerFile: Infinity,
      httpAccess: true,
      webhookAccess: true,
      canRunFlowById: true,
    },

    endpoints: {
      enabled: true,
      maxEndpoints: 3,
      memoryBytes: 512 * 1024,
      rateLimitPerMinute: 30,
      maxRequestBytes: 128 * 1024,
      historyLimit: 20,
      errorLogs: true,
      ipWhitelist: false,
      advancedStats: false,
      priorityProcessing: false,
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
    dailyMultiplier: 1.6,
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

    twitchAlertLimit: Infinity,
    twitchMissionLimit: Infinity,

    logicBuilderFlowLimit: Infinity,
    logicScriptFileLimit: Infinity,
    logicScript: {
      maxFunctionsPerFile: Infinity,
      httpAccess: true,
      webhookAccess: true,
      canRunFlowById: true,
    },

    endpoints: {
      enabled: true,
      maxEndpoints: 9,
      memoryBytes: 4 * 1024 * 1024,
      rateLimitPerMinute: 120,
      maxRequestBytes: 1024 * 1024,
      historyLimit: 200,
      errorLogs: true,
      ipWhitelist: true,
      advancedStats: true,
      priorityProcessing: true,
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
    dailyMultiplier: 2,
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
