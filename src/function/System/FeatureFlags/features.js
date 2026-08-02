'use strict';

/**
 * ⚠️ ARQUIVO ESPELHADO ENTRE BOT E SITE.
 *
 * Este arquivo existe idêntico nos dois projetos:
 *   - Ayami/src/function/System/FeatureFlags/features.js   (bot)
 *   - site/config/features.js                               (site)
 *
 * Sempre que este arquivo mudar de um lado (nova feature, mudança de
 * modo), replique a mudança no outro. Ver site/services/featureAccess.js
 * para a versão da Dashboard de FeatureManager#canUse.
 */

const FEATURE_MODES = Object.freeze({
  DISABLED: 'disabled',
  PUBLIC:   'public',
  BETA:     'beta',
});

// Registro central de feature flags do bot.
// Cada entrada: { mode: FEATURE_MODES.*, description: string }
const FEATURES = Object.freeze({
  twitch: {
    mode: FEATURE_MODES.BETA,
    description: 'Integração com a Twitch',
  },

  youtube: {
    mode: FEATURE_MODES.BETA,
    description: 'Integração com o YouTube',
  },
});

module.exports = { FEATURES, FEATURE_MODES };
