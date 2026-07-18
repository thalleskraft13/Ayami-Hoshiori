'use strict';

const DiscordRequest = require('../../DiscordRequest.js');

/**
 * RaidIntelligence
 * ──────────────────────────────────────────────────────────────────────────
 * Motor de detecção de raid MULTI-FATOR. Substitui a antiga lógica de
 * "contar joins/minuto e comparar com um limite", que dependia de um
 * único evento e gerava falsos positivos (ex: um servidor grande com
 * evento de divulgação legítimo).
 *
 * Como funciona:
 *   A cada join ou mensagem, a Ayami atualiza janelas deslizantes em
 *   memória (por servidor) e recalcula um "score de risco" (0-100),
 *   combinando vários fatores independentes:
 *
 *     - joinRate          → muitas contas entrando por minuto
 *     - newAccounts       → % de contas recém-criadas entre quem entrou
 *     - duplicateMessages → mensagens ~idênticas vindas de usuários diferentes
 *     - coordinatedSpam   → muitos usuários distintos postando no mesmo burst
 *     - massMentions      → volume de menções acima do normal na janela
 *     - massInvites       → vários convites postados por usuários diferentes
 *
 *   REGRA DE OURO: nunca aciona a resposta de raid com base em um único
 *   fator isolado. Mesmo que um fator bata 100/100 sozinho, ele só soma
 *   ao score contribuindo com seu peso — a resposta automática exige o
 *   score final >= riskThreshold E pelo menos 2 fatores distintos tendo
 *   contribuído (ver `_isCorroborated`). Isso é o que minimiza falsos
 *   positivos pedido na especificação.
 *
 *   Estado em memória é reconstruído do zero a cada restart do bot (é
 *   apenas uma janela de poucos minutos, não precisa persistir); o que É
 *   persistido no Mongo é o HISTÓRICO de detecções e o estado de
 *   emergência ativa (para sobreviver a um restart durante um ataque).
 */

// Pesos de cada fator no score final (somam 100)
const WEIGHTS = Object.freeze({
  joinRate:          25,
  newAccounts:        20,
  duplicateMessages:  20,
  coordinatedSpam:    15,
  massMentions:       10,
  massInvites:        10,
});

const FACTOR_LABEL = Object.freeze({
  joinRate:           'Muitas contas entrando',
  newAccounts:         'Contas recém-criadas',
  duplicateMessages:   'Mensagens repetidas',
  coordinatedSpam:     'Spam coordenado',
  massMentions:        'Volume de menções',
  massInvites:         'Convites em massa',
});

const JOIN_WINDOW_MS    = 60_000;   // 1 min — usado tanto p/ joinRate quanto newAccounts
const MSG_WINDOW_MS     = 30_000;   // 30s — janela para sinais baseados em mensagem
const CALM_CHECK_MS     = 60_000;   // frequência do relógio de auto-restore
const INVITE_REGEX      = /(discord\.gg\/|discord(?:app)?\.com\/invite\/)[a-z0-9-]+/i;

function normalizeContent(content) {
  return (content || '')
    .toLowerCase()
    .replace(/<a?:\w+:\d+>/g, '')      // remove emojis customizados
    .replace(/https?:\/\/\S+/g, '')    // remove links (senão cada msg vira "única")
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrai o timestamp de criação de um snowflake do Discord. */
function snowflakeToTimestamp(id) {
  try {
    const DISCORD_EPOCH = 1420070400000n;
    return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
  } catch {
    return Date.now(); // fallback conservador: trata como conta "nova agora"
  }
}

class RaidIntelligence {
  /**
   * @param {object} security - instância de SecuritySystem (usada como
   *   ponte para persistência, alertas, permissões e ações de emergência).
   */
  constructor(security) {
    this.security = security;
    this._state = {}; // guildId -> { joins:[], messages:[] }
    this._calmTimer = setInterval(() => this._checkAutoRestoreAll().catch(() => {}), CALM_CHECK_MS);
    this._calmTimer.unref?.();
  }

  _stateFor(guildId) {
    if (!this._state[guildId]) this._state[guildId] = { joins: [], messages: [] };
    return this._state[guildId];
  }

  _prune(guildId, now = Date.now()) {
    const st = this._stateFor(guildId);
    st.joins    = st.joins.filter(j => now - j.t < JOIN_WINDOW_MS);
    st.messages = st.messages.filter(m => now - m.t < MSG_WINDOW_MS);
    return st;
  }

  /* ═══════════════════════ ENTRADA DE DADOS ═══════════════════════ */

  /** Chamado pelo SecuritySystem em GUILD_MEMBER_ADD. */
  async registerJoin(guild, guildId, sec, userId) {
    const now = Date.now();
    const st  = this._prune(guildId, now);
    st.joins.push({ t: now, userId, accountAgeMs: now - snowflakeToTimestamp(userId) });
    return this._evaluate(guild, guildId, sec, now);
  }

  /** Chamado pelo SecuritySystem em MESSAGE_CREATE (fora do fluxo de automod, não bloqueia nada). */
  async registerMessage(guild, guildId, sec, { userId, content, mentionCount }) {
    const now = Date.now();
    const st  = this._prune(guildId, now);
    st.messages.push({
      t: now,
      userId,
      norm: normalizeContent(content),
      mentionCount: mentionCount || 0,
      hasInvite: INVITE_REGEX.test(content || ''),
    });
    // Sinais de mensagem só valem a pena recalcular o score quando há
    // volume mínimo — evita recomputar em servidores calmos a cada msg.
    if (st.messages.length < 3) return null;
    return this._evaluate(guild, guildId, sec, now);
  }

  /* ═══════════════════════ CÁLCULO DE RISCO ═══════════════════════ */

  _scoreJoinRate(st, cfg) {
    if (!cfg?.enabled) return null;
    const limit = cfg.joinLimit || 10;
    const count = st.joins.length;
    if (count === 0) return { score: 0, detail: `${count} joins/min` };
    const score = Math.min(100, Math.round((count / limit) * 100));
    return { score, detail: `${count} joins no último minuto (limite: ${limit})` };
  }

  _scoreNewAccounts(st, cfg) {
    if (!cfg?.enabled || st.joins.length === 0) return null;
    const maxAgeMs = (cfg.maxAgeHours || 24) * 3_600_000;
    const newOnes  = st.joins.filter(j => j.accountAgeMs < maxAgeMs);
    const ratio    = (newOnes.length / st.joins.length) * 100;
    const target   = cfg.ratioPercent || 50;
    const score    = Math.min(100, Math.round((ratio / target) * 100));
    return { score, detail: `${newOnes.length}/${st.joins.length} contas com menos de ${cfg.maxAgeHours || 24}h (${Math.round(ratio)}%)` };
  }

  _scoreDuplicateMessages(st, cfg) {
    if (!cfg?.enabled) return null;
    const groups = new Map();
    for (const m of st.messages) {
      if (!m.norm || m.norm.length < 3) continue;
      if (!groups.has(m.norm)) groups.set(m.norm, new Set());
      groups.get(m.norm).add(m.userId);
    }
    let maxDistinctUsers = 0;
    for (const users of groups.values()) maxDistinctUsers = Math.max(maxDistinctUsers, users.size);
    if (maxDistinctUsers === 0) return { score: 0, detail: 'nenhuma repetição' };
    const min   = cfg.minCount || 5;
    const score = Math.min(100, Math.round((maxDistinctUsers / min) * 100));
    return { score, detail: `${maxDistinctUsers} usuários diferentes enviando a mesma mensagem` };
  }

  _scoreCoordinatedSpam(st, cfg) {
    if (!cfg?.enabled) return null;
    const windowMs = (cfg.windowSec || 10) * 1000;
    const now = Date.now();
    const burst = st.messages.filter(m => now - m.t < windowMs);
    const distinctUsers = new Set(burst.map(m => m.userId)).size;
    if (distinctUsers === 0) return { score: 0, detail: 'sem burst recente' };
    const min   = cfg.minUsers || 6;
    const score = Math.min(100, Math.round((distinctUsers / min) * 100));
    return { score, detail: `${distinctUsers} usuários distintos postando em ${cfg.windowSec || 10}s` };
  }

  _scoreMassMentions(st, cfg) {
    if (!cfg?.enabled) return null;
    const total = st.messages.reduce((sum, m) => sum + (m.mentionCount || 0), 0);
    const distinctUsers = new Set(st.messages.filter(m => m.mentionCount > 0).map(m => m.userId)).size;
    if (total === 0) return { score: 0, detail: 'sem menções' };
    const min   = cfg.minCount || 15;
    const score = Math.min(100, Math.round((total / min) * 100));
    return { score, detail: `${total} menções na janela (${distinctUsers} usuários)` };
  }

  _scoreMassInvites(st, cfg) {
    if (!cfg?.enabled) return null;
    const inviteMsgs    = st.messages.filter(m => m.hasInvite);
    const distinctUsers = new Set(inviteMsgs.map(m => m.userId)).size;
    if (distinctUsers === 0) return { score: 0, detail: 'sem convites' };
    const min   = cfg.minCount || 4;
    const score = Math.min(100, Math.round((distinctUsers / min) * 100));
    return { score, detail: `${distinctUsers} usuários diferentes postando convites` };
  }

  /**
   * Combina todos os fatores num score final e decide se a resposta
   * automática deve ser acionada. Retorna null se nada relevante mudou.
   */
  async _evaluate(guild, guildId, sec, now) {
    const raid = sec.raid;
    if (!raid?.enabled) return null;
    const st  = this._prune(guildId, now);
    const f   = raid.factors || {};

    const results = {
      joinRate:          this._scoreJoinRate(st, f.joinRate),
      newAccounts:       this._scoreNewAccounts(st, f.newAccounts),
      duplicateMessages: this._scoreDuplicateMessages(st, f.duplicateMessages),
      coordinatedSpam:   this._scoreCoordinatedSpam(st, f.coordinatedSpam),
      massMentions:      this._scoreMassMentions(st, f.massMentions),
      massInvites:       this._scoreMassInvites(st, f.massInvites),
    };

    // Fatores que efetivamente contribuíram (ativos e com sinal > 0)
    const active = Object.entries(results).filter(([, r]) => r && r.score > 0);
    if (active.length === 0) return null;

    let weighted = 0;
    let weightSum = 0;
    for (const [key, r] of active) {
      weighted  += r.score * WEIGHTS[key];
      weightSum += WEIGHTS[key];
    }
    const score = weightSum > 0 ? Math.round(weighted / weightSum) : 0;

    // Corroboração: pelo menos 2 fatores distintos precisam estar
    // "acesos" (score >= 40) para a Ayami considerar isso um ataque real,
    // nunca um evento isolado — exceção: joinRate sozinho pode dobrar de
    // peso implicitamente já que é o fator mais barato de forjar, então
    // mantemos a regra igual para ele também.
    const litFactors = active.filter(([, r]) => r.score >= 40);
    const corroborated = litFactors.length >= 2;

    const threshold = raid.riskThreshold ?? 60;

    // Early alert em 70% do threshold, mesmo sem corroboração — é um aviso, não uma ação.
    if (raid.earlyAlerts && score >= threshold * 0.7 && score < threshold) {
      await this._maybeAlert(guildId, `⚠️ **Alerta antecipado de risco:** score ${score}/100 (abaixo do limite de ${threshold}).\n` +
        active.map(([k, r]) => `└ ${FACTOR_LABEL[k]}: ${r.score}/100 — ${r.detail}`).join('\n'));
    }

    if (score < threshold || !corroborated) return { score, active, triggered: false };

    return this._trigger(guild, guildId, sec, score, active, now);
  }

  /* ═══════════════════════ RESPOSTA AUTOMÁTICA ═══════════════════════ */

  async _trigger(guild, guildId, sec, score, active, now) {
    const raid = sec.raid;

    // Debounce: não dispara de novo se já disparou há menos de 30s (evita
    // reagir a cada mensagem/join durante o mesmo ataque contínuo).
    if (raid.state?.lastHighRiskAt && now - raid.state.lastHighRiskAt < 30_000) {
      raid.state.lastHighRiskAt = now;
      guild.markModified('security');
      await this.security.save(guild);
      return { score, active, triggered: true, debounced: true };
    }

    const factorsHit = active.map(([k, r]) => ({ key: k, score: r.score, detail: r.detail }));

    if (!raid.history) raid.history = [];
    raid.history.push({ timestamp: now, score, factors: factorsHit, action: raid.action || 'nothing' });
    if (raid.history.length > 30) raid.history = raid.history.slice(-30);

    if (!raid.state) raid.state = { emergencyActive: false, lastHighRiskAt: null, flaggedUserIds: [] };
    raid.state.lastHighRiskAt = now;
    raid.state.flaggedUserIds = Array.from(new Set([
      ...(raid.state.flaggedUserIds || []),
      ...this._stateFor(guildId).joins.map(j => j.userId),
    ])).slice(-200);

    const breakdown = factorsHit.map(f => `└ **${FACTOR_LABEL[f.key]}**: ${f.score}/100 — ${f.detail}`).join('\n');
    await this._maybeAlert(guildId,
      `🚨 **Raid detectado!** Score de risco: **${score}/100**\n${breakdown}\n` +
      `⚡ Ação automática: **${raid.action || 'nothing'}**`
    );

    await this._applyResponse(guild, guildId, sec, raid);

    guild.markModified('security');
    await this.security.save(guild);

    return { score, active, triggered: true, factorsHit };
  }

  async _applyResponse(guild, guildId, sec, raid) {
    const action = raid.action || 'nothing';

    if (raid.autoLockdown && !sec.emergency?.active) {
      const success = await this.security._emergencyLockdown(guild, guildId);
      if (success) {
        sec.emergency = sec.emergency || {};
        sec.emergency.active = true;
        raid.state.emergencyActive = true;
        this.security._logEmergencyEvent(guild, 'Lockdown automático — AntiRaid Inteligente');
        await this._maybeAlert(guildId, '🔒 **Lockdown ativado automaticamente** pelo AntiRaid Inteligente.');
      }
    }

    if (action === 'nothing') return;

    // Pune quem entrou durante a janela de risco (os "suspeitos" reais do
    // pico atual), não o servidor inteiro.
    const targets = this._stateFor(guildId).joins.map(j => j.userId);
    if (!targets.length && action !== 'lockdown') return;

    for (const userId of targets) {
      try {
        if (action === 'kick' && await this.security._hasBotPerms(guildId, ['KICK_MEMBERS'])) {
          await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' });
        } else if (action === 'ban' && await this.security._hasBotPerms(guildId, ['BAN_MEMBERS'])) {
          await DiscordRequest(`/guilds/${guildId}/bans/${userId}`, { method: 'PUT', body: { delete_message_seconds: 0 } });
        } else if (action === 'timeout' && await this.security._hasBotPerms(guildId, ['MODERATE_MEMBERS'])) {
          const until = new Date(Date.now() + 3_600_000).toISOString();
          await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: 'PATCH', body: { communication_disabled_until: until } });
        } else if (action === 'quarantine' && raid.quarantineRoleId && await this.security._hasBotPerms(guildId, ['MANAGE_ROLES'])) {
          await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${raid.quarantineRoleId}`, { method: 'PUT' });
        }
      } catch { /* usuário pode já ter saído, permissão pode faltar — segue para o próximo */ }
    }
  }

  async _maybeAlert(guildId, message) {
    try { await this.security.sendSecurityAlert(guildId, message); } catch { /* noop */ }
  }

  /* ═══════════════════════ AUTO-RESTORE ═══════════════════════ */

  /**
   * Roda periodicamente para todos os servidores com emergência ativa por
   * causa de um raid: se o servidor ficou calmo (score baixo) pelo tempo
   * configurado, restaura os canais e desativa a emergência sozinho.
   */
  async _checkAutoRestoreAll() {
    for (const guildId of Object.keys(this._state)) {
      try { await this._checkAutoRestore(guildId); } catch (err) { console.error('[RaidIntelligence] autoRestore:', err); }
    }
  }

  async _checkAutoRestore(guildId) {
    const guild = await this.security.getGuild(guildId);
    const sec   = this.security.getSecurity(guild);
    const raid  = sec.raid;
    if (!raid?.enabled || !raid.autoRestore) return;
    if (!raid.state?.emergencyActive) return;

    const calmForMs = (raid.restoreAfterMinutes || 10) * 60_000;
    const lastHigh   = raid.state.lastHighRiskAt || 0;
    if (Date.now() - lastHigh < calmForMs) return;

    const success = await this.security._emergencyRestore(guild, guildId);
    if (success) {
      sec.emergency.active   = false;
      raid.state.emergencyActive = false;
      raid.state.flaggedUserIds  = [];
      this.security._logEmergencyEvent(guild, 'Restauração automática — AntiRaid Inteligente (calmaria confirmada)');

      const last = raid.history?.[raid.history.length - 1];
      if (last && !last.restored) {
        last.restored   = true;
        last.restoredAt = Date.now();
      }

      guild.markModified('security');
      await this.security.save(guild);
      await this._maybeAlert(guildId, '✅ **Emergência restaurada automaticamente.** O servidor ficou estável pelo tempo configurado.');
    }
  }
}

module.exports = RaidIntelligence;
module.exports.FACTOR_LABEL = FACTOR_LABEL;
module.exports.WEIGHTS = WEIGHTS;
