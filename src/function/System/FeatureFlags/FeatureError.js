'use strict';

class FeatureLockedError extends Error {
  constructor(featureId, reason, { mode = null } = {}) {
    super(`Feature "${featureId}" está bloqueada (motivo: ${reason}).`);
    this.name = 'FeatureLockedError';
    this.featureId = featureId;
    this.reason = reason;
    this.mode = mode;
  }
}

module.exports = { FeatureLockedError };
