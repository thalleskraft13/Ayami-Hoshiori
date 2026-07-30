'use strict';

const { FEATURES, FEATURE_MODES } = require('./features.js');
const { FeatureLockedError }      = require('./FeatureError.js');
const PremiumManager              = require('../../Utils/PremiumManager.js');
const { isPlanAtLeast }           = require('../../Utils/PremiumPlans.js');
const DiscordRequest              = require('../../DiscordRequest.js');
const { localeCtx }               = require('../../Utils/ctxLocale.js');

const FEATURES_MODULE_PATH = require.resolve('./features.js');
const REQUIRED_PLAN        = 'CONSTELLATION';

const REASON = Object.freeze({
  OK:              'ok',
  NOT_REGISTERED:  'not_registered',
  DISABLED:        'disabled',
  BETA_LOCKED:     'beta_locked',
});

class FeatureManager {

  constructor(client) {
    this.client = client;
    this._features = new Map(Object.entries(FEATURES));
  }

  reload() {
    delete require.cache[FEATURES_MODULE_PATH];
    const { FEATURES: fresh } = require('./features.js');
    this._features = new Map(Object.entries(fresh));
    console.log(`[FeatureManager] ${this._features.size} feature(s) recarregada(s) de features.js.`);
  }

  exists(featureId) {
    return this._features.has(featureId);
  }

  getMode(featureId) {
    return this._features.get(featureId)?.mode ?? null;
  }

  getFeature(featureId) {
    const entry = this._features.get(featureId);
    if (!entry) return null;
    return { id: featureId, mode: entry.mode, description: entry.description ?? null };
  }

  listFeatures() {
    return [...this._features.entries()].map(([id, entry]) => ({
      id,
      mode: entry.mode,
      description: entry.description ?? null,
    }));
  }

  async canUse(featureId, { userId } = {}) {
    const entry = this._features.get(featureId);

    if (!entry) {
      console.warn(`[FeatureManager] Feature "${featureId}" não registrada em features.js — liberando por padrão.`);
      return { allowed: true, mode: null, reason: REASON.NOT_REGISTERED };
    }

    switch (entry.mode) {

      case FEATURE_MODES.DISABLED:
        return { allowed: false, mode: entry.mode, reason: REASON.DISABLED };

      case FEATURE_MODES.PUBLIC:
        return { allowed: true, mode: entry.mode, reason: REASON.OK };

      case FEATURE_MODES.BETA: {
        const premium = userId
          ? await PremiumManager.getUserPlan(userId).catch(() => ({ status: false }))
          : { status: false };

        const allowed = !!premium.status && isPlanAtLeast(premium.planId, REQUIRED_PLAN);

        return { allowed, mode: entry.mode, reason: allowed ? REASON.OK : REASON.BETA_LOCKED };
      }

      default:
        return { allowed: true, mode: entry.mode, reason: REASON.OK };
    }
  }

  async assert(featureId, { userId } = {}) {
    const result = await this.canUse(featureId, { userId });

    if (!result.allowed) {
      throw new FeatureLockedError(featureId, result.reason, { mode: result.mode });
    }

    return result;
  }

  _lockedContainer(featureId, result, ctx) {
    const emoji  = this.client.emoji;
    const t      = (key, extra = {}) => this.client.t(`featureflags.${key}`, { ...ctx, ...extra });
    const nome   = this.getFeature(featureId)?.description ?? featureId;
    const prefix = result.reason === REASON.DISABLED ? 'disabled' : 'beta_locked';

    return {
      type: 17,
      accent_color: 0x7C8FFF,
      components: [{
        type: 10,
        content:
          `${t(`${prefix}_title`, { eIcon: emoji.emduvida })}\n` +
          `${t(`${prefix}_description`, { eIcon: emoji.emburrada, nome })}`,
      }],
    };
  }

  async evaluate(interaction, featureId) {
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const result = await this.canUse(featureId, { userId });

    if (result.allowed) return { allowed: true, result };

    const ctx = localeCtx(interaction);
    return { allowed: false, result, container: this._lockedContainer(featureId, result, ctx) };
  }

  async guardInteraction(interaction, featureId) {
    const evaluation = await this.evaluate(interaction, featureId);
    if (evaluation.allowed) return true;

    try {
      await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
        method: 'POST',
        body: {
          type: 4,
          data: {
            flags: (1 << 15) | 64,
            components: [evaluation.container],
          },
        },
      });
    } catch (err) {
      console.error('[FeatureManager] Falha ao responder feature bloqueada:', err.message);
    }

    return false;
  }

  async guardDeferred(interaction, featureId) {
    const evaluation = await this.evaluate(interaction, featureId);
    if (evaluation.allowed) return true;

    try {
      await DiscordRequest(`/webhooks/${this.client.clientId}/${interaction.token}/messages/@original`, {
        method: 'PATCH',
        body: {
          flags: (1 << 15),
          components: [evaluation.container],
        },
      });
    } catch (err) {
      console.error('[FeatureManager] Falha ao editar mensagem com feature bloqueada:', err.message);
    }

    return false;
  }
}

module.exports = { FeatureManager, REASON };
