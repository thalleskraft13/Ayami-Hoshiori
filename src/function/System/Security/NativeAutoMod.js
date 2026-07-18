'use strict';

const DiscordRequest = require('../../DiscordRequest.js');

/**
 * NativeAutoMod
 * ──────────────────────────────────────────────────────────────────────────
 * Ponte entre a configuração de Segurança da Ayami e o AutoMod NATIVO do
 * Discord (`/guilds/{id}/auto-moderation/rules`).
 *
 * Por quê isso existe:
 *   O Discord já detecta e bloqueia, nativamente, no lado do servidor:
 *     - Palavras proibidas        → trigger KEYWORD
 *     - Spam                      → trigger SPAM
 *     - Muitas menções            → trigger MENTION_SPAM
 *     - Links / Convites          → trigger KEYWORD (regex + keyword_filter)
 *   Sempre que existe equivalente nativo, a Ayami NÃO reimplementa a
 *   detecção — ela apenas mantém uma regra nativa sincronizada com o que
 *   o administrador configurou no /configurar. A vantagem: o bloqueio
 *   acontece no servidor do Discord (mais rápido, sem risco de a Ayami
 *   "perder a corrida" contra o autor da mensagem) e some do gateway o
 *   volume de mensagens que a Ayami precisaria inspecionar manualmente.
 *
 *   O que o AutoMod nativo NÃO cobre (e por isso continua sendo detecção
 *   própria da Ayami, em SecuritySystem.handleMessage): Caps Lock, excesso
 *   de emojis e arquivos proibidos — não existem trigger types para isso
 *   na API do Discord.
 *
 * Limitação importante da API nativa:
 *   Uma regra de AutoMod só pode executar, no máximo: BLOCK_MESSAGE,
 *   TIMEOUT (só em regras KEYWORD/MENTION_SPAM) e SEND_ALERT_MESSAGE.
 *   Ela NUNCA pode dar warn, kick ou ban diretamente. Por isso, quando o
 *   administrador configura essas ações para um módulo "nativo", a Ayami
 *   escuta o evento de gateway AUTO_MODERATION_ACTION_EXECUTION e aplica
 *   o restante (warn/kick/ban) manualmente — ver
 *   SecuritySystem.handleAutoModExecution().
 */

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

// Nomes fixos — usados só como label visível no painel nativo do Discord,
// a Ayami nunca procura regra por nome (sempre por id salvo no Mongo).
const RULE_NAME = Object.freeze({
  badwords:    'Ayami · Palavras Proibidas',
  antispam:    'Ayami · Anti-Spam',
  antilinks:   'Ayami · Links',
  antiinvites: 'Ayami · Convites',
  antimention: 'Ayami · Anti-Mention',
});

const MAX_KEYWORDS   = 100; // limite da API para trigger KEYWORD
const MAX_ALLOWLIST  = 100;
const MAX_EXEMPT_ROLES    = 20;
const MAX_EXEMPT_CHANNELS = 50;

class NativeAutoMod {
  constructor(client) {
    this.client = client;
  }

  /* ───────────────────────── helpers genéricos ───────────────────────── */

  _timeoutSeconds(actions = []) {
    if (actions.includes('timeout_24h')) return 86400;
    if (actions.includes('timeout_1h'))  return 3600;
    if (actions.includes('timeout_10m')) return 600;
    return null;
  }

  /** Monta o array `actions` da regra nativa a partir das ações configuradas na Ayami. */
  _buildActions(cfg, { allowTimeout }) {
    const acts = cfg.actions?.length ? cfg.actions : ['delete'];
    const actions = [];

    // BLOCK_MESSAGE — sempre incluso a menos que o admin tenha desmarcado
    // "delete" explicitamente E ainda assim precisamos de >=1 ação válida
    // para o Discord aceitar a regra.
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

  /**
   * Cria a regra (se `ruleId` for null/inexistente) ou atualiza a existente.
   * Retorna o novo `ruleId`, ou `null` se a regra deveria deixar de existir
   * (conteúdo vazio) — nesse caso também tenta deletar a regra antiga.
   */
  async _upsert(guildId, ruleId, payload) {
    try {
      if (ruleId) {
        await DiscordRequest(`/guilds/${guildId}/auto-moderation/rules/${ruleId}`, {
          method: 'PATCH',
          body: payload,
        });
        return ruleId;
      }
    } catch (err) {
      // Regra pode ter sido apagada manualmente no Discord — recria do zero.
      console.warn(`[NativeAutoMod] PATCH falhou (guild ${guildId}, rule ${ruleId}), recriando:`, err.message);
      ruleId = null;
    }

    try {
      const created = await DiscordRequest(`/guilds/${guildId}/auto-moderation/rules`, {
        method: 'POST',
        body: payload,
      });
      return created?.id ?? null;
    } catch (err) {
      // Causas comuns: falta de permissão MANAGE_GUILD do bot, ou limite de
      // 6 regras de keyword custom por servidor já atingido.
      console.error(`[NativeAutoMod] Falha ao criar regra "${payload.name}" na guild ${guildId}:`, err.message);
      return null;
    }
  }

  async _delete(guildId, ruleId) {
    if (!ruleId) return null;
    try {
      await DiscordRequest(`/guilds/${guildId}/auto-moderation/rules/${ruleId}`, { method: 'DELETE' });
    } catch (err) {
      // Já pode não existir mais — ignora.
    }
    return null;
  }

  /* ───────────────────────── módulos ───────────────────────── */

  /** Palavras proibidas → trigger KEYWORD */
  async syncBadwords(guildId, cfg) {
    if (!cfg.enabled || !cfg.list?.length) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return cfg.nativeRuleId;
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

    cfg.nativeRuleId = await this._upsert(guildId, cfg.nativeRuleId, payload);
    return cfg.nativeRuleId;
  }

  /** Spam → trigger SPAM (heurística interna do Discord, sem parâmetros configuráveis) */
  async syncAntispam(guildId, cfg) {
    if (!cfg.enabled) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return cfg.nativeRuleId;
    }

    const payload = {
      name: RULE_NAME.antispam,
      event_type: EVENT_MESSAGE_SEND,
      trigger_type: TRIGGER.SPAM,
      trigger_metadata: {},
      // TIMEOUT não é suportado em regras do tipo SPAM pela API do Discord.
      actions: this._buildActions(cfg, { allowTimeout: false }),
      enabled: true,
      exempt_roles:    (cfg.ignoredRoles    || []).slice(0, MAX_EXEMPT_ROLES),
      exempt_channels: (cfg.ignoredChannels || []).slice(0, MAX_EXEMPT_CHANNELS),
    };

    cfg.nativeRuleId = await this._upsert(guildId, cfg.nativeRuleId, payload);
    return cfg.nativeRuleId;
  }

  /** Links → trigger KEYWORD (regex genérico de URL + allow/block list de domínios) */
  async syncAntilinks(guildId, cfg) {
    const hasContent = cfg.enabled; // "Links" pode ficar ativo mesmo sem listas (bloqueia qualquer link)
    if (!hasContent) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return cfg.nativeRuleId;
    }

    const payload = {
      name: RULE_NAME.antilinks,
      event_type: EVENT_MESSAGE_SEND,
      trigger_type: TRIGGER.KEYWORD,
      trigger_metadata: {
        // Detecta qualquer URL genérica.
        regex_patterns: ['https?://\\S+', 'www\\.\\S+\\.\\S+'],
        keyword_filter: (cfg.blockedDomains || []).slice(0, MAX_KEYWORDS).map(d => `*${d}*`),
        allow_list:     (cfg.allowedDomains || []).slice(0, MAX_ALLOWLIST).map(d => `*${d}*`),
      },
      actions: this._buildActions(cfg, { allowTimeout: true }),
      enabled: true,
      exempt_roles:    (cfg.ignoredRoles    || []).slice(0, MAX_EXEMPT_ROLES),
      exempt_channels: (cfg.ignoredChannels || []).slice(0, MAX_EXEMPT_CHANNELS),
    };

    cfg.nativeRuleId = await this._upsert(guildId, cfg.nativeRuleId, payload);
    return cfg.nativeRuleId;
  }

  /** Convites → trigger KEYWORD dedicado (fica ligado/desligado por antilinks.blockInvites) */
  async syncInvites(guildId, cfg) {
    if (!cfg.enabled || !cfg.blockInvites) {
      cfg.invitesRuleId = await this._delete(guildId, cfg.invitesRuleId);
      return cfg.invitesRuleId;
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

    cfg.invitesRuleId = await this._upsert(guildId, cfg.invitesRuleId, payload);
    return cfg.invitesRuleId;
  }

  /** Muitas menções → trigger MENTION_SPAM */
  async syncAntimention(guildId, cfg) {
    if (!cfg.enabled) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return cfg.nativeRuleId;
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

    cfg.nativeRuleId = await this._upsert(guildId, cfg.nativeRuleId, payload);
    return cfg.nativeRuleId;
  }

  /** Remove todas as regras nativas de um servidor (ex: bot removido / reset de segurança). */
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
