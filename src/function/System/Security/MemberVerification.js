'use strict';

const DiscordRequest = require('../../DiscordRequest.js');

/**
 * MemberVerification
 * ──────────────────────────────────────────────────────────────────────────
 * Verifica cada novo membro contra as regras configuradas (idade mínima
 * da conta, exigir avatar personalizado) assim que ele entra no servidor.
 *
 * Regra de ouro da especificação: SEMPRE informar exatamente qual regra
 * foi violada — nunca um veredito genérico de "membro suspeito". Por
 * isso cada verificação carrega um array `violations` com uma entrada
 * por regra quebrada, e é isso que vai tanto para o alerta no canal de
 * logs quanto para o histórico salvo no Mongo.
 *
 * Dois modos, configuráveis por servidor:
 *   - "log_only"    → só registra a violação (nunca pune).
 *   - "auto_punish" → registra E aplica a punição configurada.
 *
 * Punições: none | log | timeout | kick | ban | quarantine.
 */

const RULE_LABEL = Object.freeze({
  minAccountAge:       'Idade mínima da conta',
  requireCustomAvatar: 'Avatar personalizado obrigatório',
});

function snowflakeToTimestamp(id) {
  try {
    const DISCORD_EPOCH = 1420070400000n;
    return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
  } catch {
    return Date.now();
  }
}

function humanizeMs(ms) {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} minuto(s)`;
  if (hours < 48) return `${Math.round(hours)} hora(s)`;
  return `${Math.round(hours / 24)} dia(s)`;
}

class MemberVerification {
  constructor(security) {
    this.security = security;
  }

  /**
   * Roda a verificação completa para um membro que acabou de entrar.
   * Retorna `{ violations, punished, action }` ou `null` se nada violado
   * / verificação desativada.
   */
  async check(guild, guildId, sec, user) {
    const cfg = sec.verification;
    if (!cfg?.enabled) return null;

    const violations = this._collectViolations(cfg, user);
    if (!violations.length) return null;

    const punish = cfg.mode === 'auto_punish';
    const action = punish ? (cfg.punishment || 'none') : 'log';

    // Registra sempre que há violação (mesmo em log_only, se logSuspicious
    // estiver ativo — que é o padrão) — nunca aplica ação sem deixar rastro.
    if (cfg.logSuspicious !== false || punish) {
      this._recordHistory(sec, user, violations, action);
      await this._alert(guildId, user, violations, action, punish);
    }

    if (!punish || action === 'none' || action === 'log') {
      guild.markModified('security');
      await this.security.save(guild);
      return { violations, punished: false, action };
    }

    await this._applyPunishment(guildId, user.id, cfg, action);

    guild.markModified('security');
    await this.security.save(guild);
    return { violations, punished: true, action };
  }

  _collectViolations(cfg, user) {
    const violations = [];
    const rules = cfg.rules || {};

    if (rules.minAccountAge?.enabled) {
      const ageMs  = Date.now() - snowflakeToTimestamp(user.id);
      const minMs  = (rules.minAccountAge.hours || 0) * 3_600_000;
      if (ageMs < minMs) {
        violations.push({
          key: 'minAccountAge',
          label: `${RULE_LABEL.minAccountAge}: conta criada há ${humanizeMs(ageMs)} (mínimo exigido: ${humanizeMs(minMs)})`,
        });
      }
    }

    if (rules.requireCustomAvatar?.enabled) {
      if (!user.avatar) {
        violations.push({
          key: 'requireCustomAvatar',
          label: `${RULE_LABEL.requireCustomAvatar}: usuário está com o avatar padrão do Discord`,
        });
      }
    }

    return violations;
  }

  _recordHistory(sec, user, violations, action) {
    if (!sec.verification.history) sec.verification.history = [];
    sec.verification.history.push({
      timestamp: Date.now(),
      userId: user.id,
      username: user.username || user.id,
      violations,
      action,
    });
    if (sec.verification.history.length > 50) {
      sec.verification.history = sec.verification.history.slice(-50);
    }
  }

  async _alert(guildId, user, violations, action, punished) {
    const rulesTxt = violations.map(v => `└ ${v.label}`).join('\n');
    const actionTxt = punished
      ? `⚡ Ação automática: **${action}**`
      : `📋 Modo: apenas registro (nenhuma punição aplicada)`;

    await this.security.sendSecurityAlert(guildId,
      `🛡️ **Verificação de Novos Membros** — <@${user.id}> (\`${user.username || user.id}\`) violou:\n` +
      `${rulesTxt}\n${actionTxt}`
    ).catch(() => {});
  }

  async _applyPunishment(guildId, userId, cfg, action) {
    try {
      if (action === 'timeout' && await this.security._hasBotPerms(guildId, ['MODERATE_MEMBERS'])) {
        const until = new Date(Date.now() + 3_600_000).toISOString();
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: 'PATCH', body: { communication_disabled_until: until } });
      } else if (action === 'kick' && await this.security._hasBotPerms(guildId, ['KICK_MEMBERS'])) {
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' });
      } else if (action === 'ban' && await this.security._hasBotPerms(guildId, ['BAN_MEMBERS'])) {
        await DiscordRequest(`/guilds/${guildId}/bans/${userId}`, { method: 'PUT', body: { delete_message_seconds: 0 } });
      } else if (action === 'quarantine' && cfg.quarantineRoleId && await this.security._hasBotPerms(guildId, ['MANAGE_ROLES'])) {
        await DiscordRequest(`/guilds/${guildId}/members/${userId}/roles/${cfg.quarantineRoleId}`, { method: 'PUT' });
      }
    } catch (err) {
      console.error('[MemberVerification] Falha ao aplicar punição:', err.message);
    }
  }
}

module.exports = MemberVerification;
module.exports.RULE_LABEL = RULE_LABEL;
