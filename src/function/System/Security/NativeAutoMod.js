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

  /**
   * Lista as regras de AutoMod atualmente cadastradas na Discord para o
   * servidor (GET /guilds/{id}/auto-moderation/rules).
   *
   * Por quê isso importa: vários trigger_type só permitem 1 regra por
   * servidor (SPAM, KEYWORD_PRESET, MENTION_SPAM — ver docs oficiais,
   * "Max per Guild"). Se o servidor já tem uma regra desse tipo — seja
   * porque um admin criou manualmente pelo Configurações > AutoMod do
   * Discord, seja porque o `nativeRuleId` salvo no Mongo foi perdido
   * (reset de banco, downgrade, etc.) — um POST direto de criação falha
   * com 400 "Maximum number of X rules reached", e sem essa checagem
   * esse erro ficava só no console: a Ayami salvava a config, mostrava
   * "🟢 Ativo" no painel, e a regra nativa nunca existia de fato.
   *
   * Cache curto (10s) porque várias syncs podem rodar em sequência no
   * mesmo ciclo de configuração (ex: alterar antilinks sincroniza dois
   * módulos seguidos).
   */
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
   *
   * Antes de criar do zero, tenta ADOTAR uma regra já existente no Discord
   * que corresponda (mesmo nome da Ayami, OU — para trigger_types que só
   * permitem 1 regra por guild — mesmo trigger_type, mesmo que tenha sido
   * criada manualmente). Isso evita tanto duplicatas quanto o erro
   * silencioso de "limite de regras atingido".
   *
   * Retorna `{ ok, ruleId, error, adopted }`:
   *   - ok:      true se a regra ficou sincronizada com sucesso
   *   - ruleId:  id da regra nativa (ou null se ela deveria deixar de existir)
   *   - error:   mensagem de erro legível, quando ok === false
   *   - adopted: true se uma regra pré-existente foi reaproveitada
   */
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
        // Regra pode ter sido apagada manualmente no Discord — recria do zero.
        console.warn(`[NativeAutoMod] PATCH falhou (guild ${guildId}, rule ${ruleId}), recriando:`, err.message);
        ruleId = null;
      }
    }

    // Tenta adotar uma regra existente antes de criar uma nova.
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
      // Falha ao listar (ex: bot sem permissão MANAGE_GUILD) — segue tentando criar direto,
      // o erro real (mais específico) vai aparecer na tentativa de POST abaixo.
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
      // Causas comuns: falta de permissão MANAGE_GUILD do bot, ou limite de
      // regras desse trigger_type já atingido no servidor.
      console.error(`[NativeAutoMod] Falha ao criar regra "${payload.name}" na guild ${guildId}:`, err.message);
      return { ok: false, ruleId: null, error: this._humanizeError(err) };
    }
  }

  /** Traduz o erro cru da API do Discord numa mensagem curta e acionável. */
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

  /* ───────────────────────── módulos ───────────────────────── */

  /** Palavras proibidas → trigger KEYWORD (máx. 6 regras KEYWORD por guild) */
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

  /** Spam → trigger SPAM (heurística interna do Discord, sem parâmetros configuráveis; MÁX. 1 por guild) */
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
      // TIMEOUT não é suportado em regras do tipo SPAM pela API do Discord.
      actions: this._buildActions(cfg, { allowTimeout: false }),
      enabled: true,
      exempt_roles:    (cfg.ignoredRoles    || []).slice(0, MAX_EXEMPT_ROLES),
      exempt_channels: (cfg.ignoredChannels || []).slice(0, MAX_EXEMPT_CHANNELS),
    };

    const result = await this._upsert(guildId, cfg.nativeRuleId, payload, { triggerType: TRIGGER.SPAM, singleton: true });
    cfg.nativeRuleId = result.ruleId;
    return result;
  }

  /** Links → trigger KEYWORD (regex genérico de URL + allow/block list de domínios) */
  async syncAntilinks(guildId, cfg) {
    const hasContent = cfg.enabled; // "Links" pode ficar ativo mesmo sem listas (bloqueia qualquer link)
    if (!hasContent) {
      cfg.nativeRuleId = await this._delete(guildId, cfg.nativeRuleId);
      return { ok: true, ruleId: null };
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

    const result = await this._upsert(guildId, cfg.nativeRuleId, payload, { triggerType: TRIGGER.KEYWORD, singleton: false });
    cfg.nativeRuleId = result.ruleId;
    return result;
  }

  /** Convites → trigger KEYWORD dedicado (fica ligado/desligado por antilinks.blockInvites) */
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

  /** Muitas menções → trigger MENTION_SPAM (MÁX. 1 por guild — ver nota em _upsert) */
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
