'use strict';

const DiscordRequest = require('../../DiscordRequest.js');


const TRIGGER = Object.freeze({
  KEYWORD:      1,
  SPAM:         3,
  KEYWORD_PRESET: 4,
  MENTION_SPAM: 5,
});

const ACTION = Object.freeze({
  BLOCK_MESSAGE: 1,
  SEND_ALERT:    2,
  TIMEOUT:       3,
  BLOCK_MEMBER_INTERACTION: 4,
});

const EVENT_MESSAGE_SEND = 1;

const RULE_NAME = Object.freeze({
  badwords:    'Ayami · Palavras Proibidas',
  antispam:    'Ayami · Anti-Spam',
  antilinks:   'Ayami · Links',
  antiinvites: 'Ayami · Convites',
  antimention: 'Ayami · Anti-Mention',
});

const MAX_KEYWORDS   = 100; 
const MAX_ALLOWLIST  = 100;
const MAX_EXEMPT_ROLES    = 20;
const MAX_EXEMPT_CHANNELS = 50;

class NativeAutoMod {
  constructor(client) {
    this.client = client;
  }


  async listRules(guildId, { fresh = false } = {}) {
    const now = Date.now();
    if (!fresh && this._rulesCache?.guildId === guildId && now - this._rulesCache.at < 10_000) {
      return this._rulesCache.rules;
    }
    const rules = await DiscordRequest(`/guilds/${guildId}/auto-moderation/rules`, { method: 'GET' }) || [];
    this._rulesCache = { guildId, at: now, rules };
    return rules;
  }

  _invalidateRulesCache(guildId) {
    if (this._rulesCache?.guildId === guildId) this._rulesCache = null;
  }

  _timeoutSeconds(actions = []) {
    if (actions.includes('timeout_24h')) return 86400;
    if (actions.includes('timeout_1h'))  return 3600;
    if (actions.includes('timeout_10m')) return 600;
    return null;
  }

  _buildActions(cfg, { allowTimeout }) {
    const acts = cfg.actions?.length ? cfg.actions : ['delete'];
    const actions = [];

    if (acts.includes('delete') || true) {
      actions.push({ type: ACTION.BLOCK_MESSAGE, metadata: {} });
    }

    if (allowTimeout) {
      const seconds = this._timeoutSeconds(acts);
      if (seconds) {
        actions.push({ type: ACTION.TIMEOUT, metadata: { duration_seconds: seconds } });
      }
    }

    return actions;
  }

  async _upsert(guildId, ruleId, payload, { triggerType, singleton = false } = {}) {
    if (ruleId) {
      try {
        await DiscordRequest(`/guilds/${guildId}/auto-moderation/rules/${ruleId}`, {
          method: 'PATCH',
          body: payload,
        });
        this._invalidateRulesCache(guildId);
        return { ok: true, ruleId };
      } catch (err) {
        console.warn(`[NativeAutoMod] PATCH falhou (guild ${guildId}, rule ${ruleId}), recriando:`, err.message);
        ruleId = null;
      }
    }

    try {
      const existing = await this.listRules(guildId);
      const match =
        existing.find(r => r.name === payload.name) ||
        (singleton ? existing.find(r => r.trigger_type === triggerType) : null);

      if (match) {
        try {
          await DiscordRequest(`/guilds/${guildId}/auto-moderation/rules/${match.id}`, {
            method: 'PATCH',
            body: payload,
          });
          this._invalidateRulesCache(guildId);
          return { ok: true, ruleId: match.id, adopted: true };
        } catch (err) {
          console.error(`[NativeAutoMod] Falha ao adotar/atualizar regra existente "${match.id}" na guild ${guildId}:`, err.message);
          return { ok: false, ruleId: null, error: this._humanizeError(err) };
        }
      }
    } catch (err) {
      console.warn(`[NativeAutoMod] Falha ao listar regras existentes na guild ${guildId}:`, err.message);
    }

    try {
      const created = await DiscordRequest(`/guilds/${guildId}/auto-moderation/rules`, {
        method: 'POST',
        body: payload,
      });
      this._invalidateRulesCache(guildId);
      return { ok: true, ruleId: created?.id ?? null };
    } catch (err) {
      console.error(`[NativeAutoMod] Falha ao criar regra "${payload.name}" na guild ${guildId}:`, err.message);
      return { ok: false, ruleId: null, error: this._humanizeError(err) };
    }
  }

  _humanizeError(err) {
    const msg = err?.message || '';
    if (msg.includes('50013') || /missing permission/i.test(msg)) {
      return 'A Ayami não tem a permissão **Gerenciar Servidor** — ela é obrigatória para criar/editar regras de AutoMod nativo.';
    }
    if (/maximum number of/i.test(msg) || /max_.*rules/i.test(msg)) {
      return 'O servidor já atingiu o limite de regras desse tipo no AutoMod nativo do Discord (ex: só é permitida 1 regra de Anti-Mention/Anti-Spam por servidor). Verifique em Configurações do Servidor → AutoMod se já existe uma regra manual desse tipo.';
    }
    if (msg.includes('MODERATE_MEMBERS') || /moderate_members/i.test(msg)) {
      return 'A ação de Timeout requer que a Ayami tenha a permissão **Cronometrar Membros (Moderate Members)**.';
    }
    return msg.slice(0, 300) || 'Erro desconhecido ao falar com a API do Discord.';
  }

  async _delete(guildId, ruleId) {
    if (!ruleId) return null;
    try {
      await DiscordRequest(`/guilds/${guildId}/auto-moderation/rules/${ruleId}`, { method: 'DELETE' });
      this._invalidateRulesCache(guildId);
    } catch (err) {
      // Já pode não existir mais — ignora.
    }
    return null;
  }


  async syncBadwords(guildId, cfg) {
    if (!cfg.enabled || !cfg.list?.length) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return { ok: true, ruleId: null };
    }

    const payload = {
      name: RULE_NAME.badwords,
      event_type: EVENT_MESSAGE_SEND,
      trigger_type: TRIGGER.KEYWORD,
      trigger_metadata: {
        keyword_filter: cfg.list.slice(0, MAX_KEYWORDS),
      },
      actions: this._buildActions(cfg, { allowTimeout: true }),
      enabled: true,
      exempt_roles:    (cfg.ignoredRoles    || []).slice(0, MAX_EXEMPT_ROLES),
      exempt_channels: (cfg.ignoredChannels || []).slice(0, MAX_EXEMPT_CHANNELS),
    };

    const result = await this._upsert(guildId, cfg.nativeRuleId, payload, { triggerType: TRIGGER.KEYWORD, singleton: false });
    cfg.nativeRuleId = result.ruleId;
    return result;
  }

  async syncAntispam(guildId, cfg) {
    if (!cfg.enabled) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return { ok: true, ruleId: null };
    }

    const payload = {
      name: RULE_NAME.antispam,
      event_type: EVENT_MESSAGE_SEND,
      trigger_type: TRIGGER.SPAM,
      trigger_metadata: {},
      actions: this._buildActions(cfg, { allowTimeout: false }),
      enabled: true,
      exempt_roles:    (cfg.ignoredRoles    || []).slice(0, MAX_EXEMPT_ROLES),
      exempt_channels: (cfg.ignoredChannels || []).slice(0, MAX_EXEMPT_CHANNELS),
    };

    const result = await this._upsert(guildId, cfg.nativeRuleId, payload, { triggerType: TRIGGER.SPAM, singleton: true });
    cfg.nativeRuleId = result.ruleId;
    return result;
  }

  async syncAntilinks(guildId, cfg) {
    const hasContent = cfg.enabled; 
    if (!hasContent) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return { ok: true, ruleId: null };
    }

    const payload = {
      name: RULE_NAME.antilinks,
      event_type: EVENT_MESSAGE_SEND,
      trigger_type: TRIGGER.KEYWORD,
      trigger_metadata: {
        regex_patterns: ['https?://\\S+', 'www\\.\\S+\\.\\S+'],
        keyword_filter: (cfg.blockedDomains || []).slice(0, MAX_KEYWORDS).map(d => `*${d}*`),
        allow_list:     (cfg.allowedDomains || []).slice(0, MAX_ALLOWLIST).map(d => `*${d}*`),
      },
      actions: this._buildActions(cfg, { allowTimeout: true }),
      enabled: true,
      exempt_roles:    (cfg.ignoredRoles    || []).slice(0, MAX_EXEMPT_ROLES),
      exempt_channels: (cfg.ignoredChannels || []).slice(0, MAX_EXEMPT_CHANNELS),
    };

    const result = await this._upsert(guildId, cfg.nativeRuleId, payload, { triggerType: TRIGGER.KEYWORD, singleton: false });
    cfg.nativeRuleId = result.ruleId;
    return result;
  }

  async syncInvites(guildId, cfg) {
    if (!cfg.enabled || !cfg.blockInvites) {
      cfg.invitesRuleId = await this._delete(guildId, cfg.invitesRuleId);
      return { ok: true, ruleId: null };
    }

    const payload = {
      name: RULE_NAME.antiinvites,
      event_type: EVENT_MESSAGE_SEND,
      trigger_type: TRIGGER.KEYWORD,
      trigger_metadata: {
        keyword_filter: [
          'discord.gg/*',
          '*discord.com/invite*',
          '*discordapp.com/invite*',
        ],
      },
      actions: this._buildActions(cfg, { allowTimeout: true }),
      enabled: true,
      exempt_roles:    (cfg.ignoredRoles    || []).slice(0, MAX_EXEMPT_ROLES),
      exempt_channels: (cfg.ignoredChannels || []).slice(0, MAX_EXEMPT_CHANNELS),
    };

    const result = await this._upsert(guildId, cfg.invitesRuleId, payload, { triggerType: TRIGGER.KEYWORD, singleton: false });
    cfg.invitesRuleId = result.ruleId;
    return result;
  }

  async syncAntimention(guildId, cfg) {
    if (!cfg.enabled) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return { ok: true, ruleId: null };
    }

    const payload = {
      name: RULE_NAME.antimention,
      event_type: EVENT_MESSAGE_SEND,
      trigger_type: TRIGGER.MENTION_SPAM,
      trigger_metadata: {
        mention_total_limit: Math.max(1, Math.min(cfg.maxMentions || 5, 50)),
      },
      actions: this._buildActions(cfg, { allowTimeout: true }),
      enabled: true,
      exempt_roles:    (cfg.ignoredRoles    || []).slice(0, MAX_EXEMPT_ROLES),
      exempt_channels: (cfg.ignoredChannels || []).slice(0, MAX_EXEMPT_CHANNELS),
    };

    const result = await this._upsert(guildId, cfg.nativeRuleId, payload, { triggerType: TRIGGER.MENTION_SPAM, singleton: true });
    cfg.nativeRuleId = result.ruleId;
    return result;
  }

  async purgeAll(guildId, sec) {
    const s = sec.automod.simple;
    await this._delete(guildId, s.badwords?.nativeRuleId);
    await this._delete(guildId, s.antispam?.nativeRuleId);
    await this._delete(guildId, s.antilinks?.nativeRuleId);
    await this._delete(guildId, s.antilinks?.invitesRuleId);
    await this._delete(guildId, s.antimention?.nativeRuleId);
  }
}

module.exports = NativeAutoMod;
module.exports.TRIGGER = TRIGGER;
module.exports.ACTION  = ACTION;
