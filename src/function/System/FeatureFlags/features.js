'use strict';

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
});

module.exports = { FEATURES, FEATURE_MODES };
