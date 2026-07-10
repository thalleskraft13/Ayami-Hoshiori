'use strict';

/* ═══════════════════════════════════════════════════════════
   AYAMI CONSTELLATION — DEFINIÇÃO CENTRAL DOS PLANOS PREMIUM
   ═══════════════════════════════════════════════════════════

   ⚠️ ARQUIVO ESPELHADO ENTRE BOT E SITE.

   Este arquivo existe idêntico nos dois projetos:
     - Ayami/src/function/Utils/PremiumPlans.js   (bot)
     - site/config/premiumPlans.js                (site)

   Bot e site são deploys separados (não compartilham um mesmo
   processo Node), então não dá pra fazer um "require" cruzado
   entre os dois — a unificação aqui é: os DOIS lados leem os
   MESMOS documentos do Mongo (Guild / User Global / PremiumKey)
   e concordam byte-a-byte sobre o que cada plano libera. Sempre
   que este arquivo mudar de um lado, replique a mudança no outro.

   Qualquer lugar do código (bot ou site) que precisar saber
   "o que esse plano pode fazer" ou "qual o limite disso" deve
   importar daqui — nunca duplicar esses números em outro lugar.

   Planos (do menor pro maior):
     FREE            → Gratuito, sem assinatura
     NOVA_ESTRELA    → R$ 7,99/mês
     LUA_CRESCENTE   → R$ 14,99/mês
     CONSTELLATION   → R$ 24,99/mês

   Cada plano é estritamente superior ao anterior (tudo que o
   plano de baixo libera, o de cima também libera).
   ═══════════════════════════════════════════════════════════ */

const PLAN_KEYS = {
  FREE:          'FREE',
  NOVA_ESTRELA:  'NOVA_ESTRELA',
  LUA_CRESCENTE: 'LUA_CRESCENTE',
  CONSTELLATION: 'CONSTELLATION',
};

// Ordem de "força" dos planos — usada pra comparações (>=, <, etc)
const PLAN_RANK = {
  FREE:          0,
  NOVA_ESTRELA:  1,
  LUA_CRESCENTE: 2,
  CONSTELLATION: 3,
};

/**
 * Fallback para premium concedido ANTES deste catálogo de planos existir
 * (registros legados que só tinham um boolean/expiração, sem plano
 * declarado). Historicamente essas concessões eram sempre no nível mais
 * alto (era o único "premium" que existia), então o piso de compatibilidade
 * é CONSTELLATION — nunca rebaixar um premium antigo pra um plano menor.
 */
const DEFAULT_PLAN = PLAN_KEYS.CONSTELLATION;

// chance extra de quem NÃO tem premium (baseline já existente em Banners.js)
const BASE_FIVE_STAR_EXTRA_CHANCE = 2 / 20;

const PLANS = {
  FREE: {
    key:   PLAN_KEYS.FREE,
    name:  'Gratuito',
    emoji: '🌑',
    order: PLAN_RANK.FREE,
    price: 0,
    priceLabel: 'Grátis',

    // Servidores com premium aplicado por esse usuário
    premiumGuildLimit: 0,
    guildLimit: 0, // alias (nome usado no bot)

    // Logic Builder — quantidade de fluxos por servidor
    logicBuilderFlowLimit: 10,

    // Logic Script — quantidade de arquivos .logic por servidor
    logicScriptFileLimit: 6,
    logicScript: {
      maxFunctionsPerFile: 15,
      httpAccess: false,
      webhookAccess: false,
      canRunFlowById: false,
    },

    // Tickets — filosofia "Discloud": todo mundo tem acesso, com limites
    tickets: {
      maxQuestions: 5,
      advancedTypeLimit: 0, // seleção / múltipla escolha / checkbox / anexos / membro / cargo / canal
      modalEnabled: false,
    },

    // Pode usar qualquer configuração/requisito marcado como premium
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
    },

    // "Até 10 perguntas... recursos avançados possuem limites (ex.: até 2
    // perguntas de seleção, múltipla escolha, checkbox, anexos, seleção de
    // membro, cargo e canal)."
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

    // "Perguntas ilimitadas. Todos os tipos de perguntas ilimitados."
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

    // Exclusivos do Constellation
    earlyAccess: true,
    canaryAccess: true,
  },
};

/**
 * Normaliza qualquer valor recebido (chave nova em maiúsculo, chave legada
 * em snake_case minúsculo usada antes desta unificação, string vazia,
 * undefined...) para uma das chaves válidas de PLAN_KEYS.
 * Sempre retorna algo válido — nunca lança erro nem retorna undefined.
 */
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

/** Retorna o objeto de configuração completo de um plano. */
function getPlan(planKey) {
  return PLANS[normalizePlanKey(planKey)] || PLANS.FREE;
}

/** Verifica se uma chave (em qualquer formato aceito) é um plano válido/reconhecido. */
function isValidPlan(planKey) {
  if (!planKey) return false;
  return normalizePlanKey(planKey) !== PLAN_KEYS.FREE || String(planKey).trim().toUpperCase() === PLAN_KEYS.FREE;
}

/** Compara dois planos — retorna true se `planKey` é >= `otherPlanKey`. */
function isPlanAtLeast(planKey, otherPlanKey) {
  return PLAN_RANK[normalizePlanKey(planKey)] >= PLAN_RANK[normalizePlanKey(otherPlanKey)];
}

/**
 * Determina o plano ativo de um documento de usuário (Mongodb/userglobal.js)
 * ou de servidor (Mongodb/guild.js), considerando expiração.
 *
 * Aceita tanto o novo formato (`premiumPlan` + `premiumExpiresAt`/`premiumTime`)
 * quanto o formato legado (`premium` numérico: 0 = sem premium,
 * 1 = vitalício, timestamp = expira em X).
 */
function resolveActivePlan(doc) {
  if (!doc) return PLAN_KEYS.FREE;

  const now = Date.now();

  // Formato legado (compatibilidade): guild.premiumTime / userglobal.premium
  const legacyExpire = doc.premiumTime ?? doc.premium;
  const legacyActive = legacyExpire === 1 || (typeof legacyExpire === 'number' && legacyExpire > now);

  const declaredPlan = normalizePlanKey(doc.premiumPlan);

  // Se o plano declarado é FREE mas o campo legado indica premium ativo,
  // assume DEFAULT_PLAN (Constellation) como piso — mantém compatibilidade
  // com assinaturas antigas concedidas antes deste catálogo existir.
  if (declaredPlan === PLAN_KEYS.FREE && legacyActive) {
    return DEFAULT_PLAN;
  }

  if (declaredPlan === PLAN_KEYS.FREE) return PLAN_KEYS.FREE;

  // Plano declarado existe — checa se não expirou (premiumExpiresAt tem prioridade)
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
