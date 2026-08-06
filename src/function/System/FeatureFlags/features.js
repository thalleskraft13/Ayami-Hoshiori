'use strict';

const FEATURE_MODES = Object.freeze({
  DISABLED: 'disabled',
  PUBLIC:   'public',
  BETA:     'beta',
});

const FEATURES = Object.freeze({
  twitch: {
    mode: FEATURE_MODES.PUBLIC,
    description: 'Integração com a Twitch',
  },

  youtube: {
    mode: FEATURE_MODES.BETA,
    description: 'Integração com o YouTube',
  },

  logicNodes: {
    mode: FEATURE_MODES.BETA,
    description: 'Motor de fluxos em grafo (Logic Nodes)',
  },
});

module.exports = { FEATURES, FEATURE_MODES };
