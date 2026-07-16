'use strict';

const DiscordRequest   = require('../../../DiscordRequest.js');
const AuthorizationDb  = require('../../../../Mongodb/giveawayAuthorization.js');

/**
 * GiveawayRequirements
 *
 * Verifica se um participante cumpre todos os requisitos definidos
 * no sorteio. Chamado exclusivamente durante o sorteio (não na entrada).
 *
 * Retorna: { ok: boolean, reason: string | null }
 *
 * Os "reason" aparecem no relatório público de encerramento (histórico
 * do sorteio) — não há um usuário específico assistindo nesse momento,
 * então traduzimos via client.t() com fallback automático em pt-BR.
 */
class GiveawayRequirements {

  static _t(client, key, extra = {}) {
    if (client?.t) return client.t(`sorteio.${key}`, extra);
    return key;
  }

  /**
   * @param {object} participant  Objeto do participante (userId, guildId)
   * @param {object} doc          Documento do sorteio
   * @param {object} client       Instância do cliente Discord
   */
  static async verify(participant, doc, client) {

    if (!doc.requirements?.length) return { ok: true, reason: null };

    for (const req of doc.requirements) {
      const result = await this._check(req, participant, doc, client);
      if (!result.ok) return result;
    }

    return { ok: true, reason: null };
  }

  /* ─────────────────────────────────────────
     DISPATCHER
  ───────────────────────────────────────── */

  static async _check(req, participant, doc, client) {

    try {

      switch (req.type) {

        case 'REQUIRED_ROLE':
          return this._checkRequiredRole(req, participant, doc.guildId, client);

        case 'FORBIDDEN_ROLE':
          return this._checkForbiddenRole(req, participant, doc.guildId, client);

        case 'MIN_MESSAGES':
          return this._checkMinMessages(req, participant, doc.guildId, client);

        case 'MIN_DAYS_IN_SERVER':
          return this._checkMinDaysInServer(req, participant, doc.guildId, client);

        case 'MIN_ACCOUNT_AGE':
          return this._checkMinAccountAge(req, participant, client);

        case 'IN_SERVER':
          return this._checkInServer(req, participant, client);

        // Premium — servidor externo
        case 'REQUIRED_ROLE_IN_SERVER':
          return this._checkRequiredRoleInServer(req, participant, client);

        case 'FORBIDDEN_ROLE_IN_SERVER':
          return this._checkForbiddenRoleInServer(req, participant, client);

        case 'MIN_DAYS_IN_EXT_SERVER':
          return this._checkMinDaysInExtServer(req, participant, client);

        case 'MIN_MESSAGES_IN_EXT_SERVER':
          return this._checkMinMessagesInExtServer(req, participant, client);

        case 'MIN_HOURS_IN_CALL':
          return this._checkMinHoursInCall(req, participant, client);

        case 'MIN_LEVEL':
          return this._checkMinLevel(req, participant, client);

        case 'MIN_XP':
          return this._checkMinXP(req, participant, client);

        case 'HAS_BOOSTER_ROLE':
          return this._checkBooster(participant, req.guildId || doc.guildId, client);

        case 'HAS_SUPPORTER_ROLE':
          return this._checkSupporter(req, participant, client);

        default:
          return { ok: true, reason: null };
      }

    } catch (err) {
      console.error(`[GiveawayRequirements] Erro ao verificar ${req.type}:`, err);
      // Em caso de erro de API, não desclassificar (benefício da dúvida)
      return { ok: true, reason: null };
    }
  }

  /* ─────────────────────────────────────────
     VERIFICAÇÕES — SERVIDOR ATUAL
  ───────────────────────────────────────── */

  static async _checkRequiredRole(req, participant, guildId, client) {

    const member = await this._getMember(guildId, participant.userId);
    if (!member) return { ok: false, reason: this._t(client, 'req_not_in_server') };

    const has = member.roles.includes(req.value);
    return {
      ok: has,
      reason: has ? null : this._t(client, 'req_missing_required_role', { value: req.value }),
    };
  }

  static async _checkForbiddenRole(req, participant, guildId, client) {

    const member = await this._getMember(guildId, participant.userId);
    if (!member) return { ok: false, reason: this._t(client, 'req_not_in_server') };

    const has = member.roles.includes(req.value);
    return {
      ok: !has,
      reason: has ? this._t(client, 'req_has_forbidden_role', { value: req.value }) : null,
    };
  }

  static async _checkMinMessages(req, participant, guildId, client) {

    const minMsg = parseInt(req.value) || 0;

    try {
      // Usa o GiveawayMessageTracker registrado em client.giveaway.messageTracker
      const count = await client.giveaway?.messageTracker?.getCount(participant.userId, guildId) ?? 0;
      return {
        ok: count >= minMsg,
        reason: count >= minMsg ? null : this._t(client, 'req_not_enough_messages', { count, min: minMsg }),
      };
    } catch {
      return { ok: true, reason: null };
    }
  }

  static async _checkMinDaysInServer(req, participant, guildId, client) {

    const minDays = parseInt(req.value) || 0;
    const member  = await this._getMember(guildId, participant.userId);

    if (!member) return { ok: false, reason: this._t(client, 'req_not_in_server') };

    const joinedAt = new Date(member.joined_at);
    const days     = Math.floor((Date.now() - joinedAt.getTime()) / 864e5);

    return {
      ok: days >= minDays,
      reason: days >= minDays
        ? null
        : this._t(client, 'req_not_enough_days_server', { days, min: minDays }),
    };
  }

  static async _checkMinAccountAge(req, participant, client) {

    const minDays = parseInt(req.value) || 0;

    // Calcular idade da conta a partir do userId (Snowflake)
    const snowflake = BigInt(participant.userId);
    const createdAt = new Date(Number((snowflake >> 22n) + 1420070400000n));
    const days      = Math.floor((Date.now() - createdAt.getTime()) / 864e5);

    return {
      ok: days >= minDays,
      reason: days >= minDays
        ? null
        : this._t(client, 'req_account_too_new', { days, min: minDays }),
    };
  }

  /* ─────────────────────────────────────────
     VERIFICAÇÕES — OUTRO SERVIDOR (GRATUITO)
  ───────────────────────────────────────── */

  static async _checkInServer(req, participant, client) {

    const member = await this._getMember(req.guildId, participant.userId);
    return {
      ok: !!member,
      reason: member ? null : this._t(client, 'req_not_in_partner_server', { guildId: req.guildId }),
    };
  }

  /* ─────────────────────────────────────────
     VERIFICAÇÕES — OUTRO SERVIDOR (PREMIUM)
  ───────────────────────────────────────── */

  static async _checkRequiredRoleInServer(req, participant, client) {

    const member = await this._getMember(req.guildId, participant.userId);
    if (!member) return { ok: false, reason: this._t(client, 'req_not_in_ext_server', { guildId: req.guildId }) };

    const has = member.roles.includes(req.value);
    return {
      ok: has,
      reason: has ? null : this._t(client, 'req_missing_role_ext', { guildId: req.guildId }),
    };
  }

  static async _checkForbiddenRoleInServer(req, participant, client) {

    const member = await this._getMember(req.guildId, participant.userId);
    if (!member) return { ok: false, reason: this._t(client, 'req_not_in_ext_server', { guildId: req.guildId }) };

    const has = member.roles.includes(req.value);
    return {
      ok: !has,
      reason: has ? this._t(client, 'req_has_forbidden_role_ext', { guildId: req.guildId }) : null,
    };
  }

  static async _checkMinDaysInExtServer(req, participant, client) {

    const minDays = parseInt(req.value) || 0;
    const member  = await this._getMember(req.guildId, participant.userId);

    if (!member) return { ok: false, reason: this._t(client, 'req_not_in_ext_server', { guildId: req.guildId }) };

    const joinedAt = new Date(member.joined_at);
    const days     = Math.floor((Date.now() - joinedAt.getTime()) / 864e5);

    return {
      ok: days >= minDays,
      reason: days >= minDays
        ? null
        : this._t(client, 'req_not_enough_days_ext', { days, min: minDays }),
    };
  }

  static async _checkMinMessagesInExtServer(req, participant, client) {

    const minMsg = parseInt(req.value) || 0;

    try {
      const stats = await client.stats?.getMessages?.(participant.userId, req.guildId);
      const count = stats?.messages ?? 0;
      return {
        ok: count >= minMsg,
        reason: count >= minMsg
          ? null
          : this._t(client, 'req_not_enough_messages_ext', { count, min: minMsg }),
      };
    } catch {
      return { ok: true, reason: null };
    }
  }

  static async _checkMinHoursInCall(req, participant, client) {

    const minHours = parseFloat(req.value) || 0;

    try {
      const stats = await client.stats?.getVoiceHours?.(participant.userId, req.guildId);
      const hours = stats?.hours ?? 0;
      return {
        ok: hours >= minHours,
        reason: hours >= minHours
          ? null
          : this._t(client, 'req_not_enough_call_hours', { hours: hours.toFixed(1), min: minHours }),
      };
    } catch {
      return { ok: true, reason: null };
    }
  }

  static async _checkMinLevel(req, participant, client) {

    const minLevel = parseInt(req.value) || 0;

    try {
      const stats = await client.levels?.getLevel?.(participant.userId, req.guildId);
      const level = stats?.level ?? 0;
      return {
        ok: level >= minLevel,
        reason: level >= minLevel
          ? null
          : this._t(client, 'req_level_too_low', { level, min: minLevel }),
      };
    } catch {
      return { ok: true, reason: null };
    }
  }

  static async _checkMinXP(req, participant, client) {

    const minXP = parseInt(req.value) || 0;

    try {
      const stats = await client.levels?.getXP?.(participant.userId, req.guildId);
      const xp    = stats?.xp ?? 0;
      return {
        ok: xp >= minXP,
        reason: xp >= minXP
          ? null
          : this._t(client, 'req_xp_too_low', { xp, min: minXP }),
      };
    } catch {
      return { ok: true, reason: null };
    }
  }

  static async _checkBooster(participant, guildId, client) {

    const member = await this._getMember(guildId, participant.userId);
    if (!member) return { ok: false, reason: this._t(client, 'req_not_in_server') };

    const isBooster = !!member.premium_since;
    return {
      ok: isBooster,
      reason: isBooster ? null : this._t(client, 'req_not_booster'),
    };
  }

  static async _checkSupporter(req, participant, client) {

    /*
      "Cargo Apoiador" depende da definição do seu bot.
      Adapte para o sistema de apoiador que você utiliza.
    */
    try {
      const isSupporter = await client.supporter?.check?.(participant.userId, req.guildId);
      return {
        ok: !!isSupporter,
        reason: isSupporter ? null : this._t(client, 'req_not_supporter'),
      };
    } catch {
      return { ok: true, reason: null };
    }
  }

  /* ─────────────────────────────────────────
     HELPER — BUSCAR MEMBRO
  ───────────────────────────────────────── */

  static async _getMember(guildId, userId) {
    try {
      return await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
        method: 'GET',
      });
    } catch {
      return null;
    }
  }
}

module.exports = GiveawayRequirements;
