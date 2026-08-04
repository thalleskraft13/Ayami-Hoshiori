'use strict';

const DiscordRequest = require('../../DiscordRequest.js');
const getPerm         = require('../../Utils/GetPerm.js');

const HouseConfigService = require('./HouseConfigService.js');
const CallService          = require('./CallService.js');
const ActivityService        = require('./ActivityService.js');
const CharacterService         = require('./CharacterService.js');
const HistoryService             = require('./HistoryService.js');
const PremiumService               = require('./PremiumService.js');

const ACCENT = 0x7C8FFF;
const INACTIVITY_CHECK_HOUR = 4;

class CallScheduler {

  constructor(client) {
    this.client   = client;
    this.config    = new HouseConfigService();
    this.call        = new CallService();
    this.activity      = new ActivityService();
    this.characters      = new CharacterService();
    this.history            = new HistoryService();
    this.premium              = new PremiumService();
  }

  get tasks() {
    return this.client.taskManager;
  }

  async syncSchedule(guildId, cfg) {
    const schedule = cfg?.call?.schedule;

    if (!schedule?.enabled || schedule.hour == null || !(await this.premium.hasSubscription(guildId))) {
      return this.cancelSchedule(guildId);
    }

    await this.tasks.createHouseCallScheduled({ guildId, hour: schedule.hour, minute: schedule.minute ?? 0 });
  }

  async cancelSchedule(guildId) {
    await this.tasks.cancelHouseCallScheduled(guildId);
  }

  async syncCallTimeout(guildId) {
    const openCall = await this.call.getOpen(guildId);

    if (!openCall?.closesAt) {
      return this.cancelCallTimeout(guildId);
    }

    await this.tasks.createHouseCallTimeout({ guildId, closesAt: openCall.closesAt });
  }

  async cancelCallTimeout(guildId) {
    await this.tasks.cancelHouseCallTimeout(guildId);
  }

  async runCallTimeout(guildId) {
    const cfg = await this.config.get(guildId);
    if (!cfg) return;

    const openCall = await this.call.getOpen(guildId);
    if (!openCall) return;

    const expected = await this._expectedCallMembers(guildId);
    const result    = await this.call.closeByTimeout(guildId, expected);
    if (!result.ok) return;

    await this.history.log(guildId, {
      action: 'chamada_encerrada',
      detail: this.client.t('house.detail_call_auto_closed', {
        percent: result.stats.percent, present: result.stats.present, total: result.stats.total,
      }),
    });

    await this.logCallClosed(guildId, cfg, result.stats, null);
  }

  async _expectedCallMembers(guildId) {
    const occupied = await this.characters.listOccupied(guildId);
    return occupied.map(c => c.currentUserId).filter(Boolean);
  }

  buildCallMessagePayload(cfg) {
    const mention = cfg.call.notifyRoleId ? `<@&${cfg.call.notifyRoleId}> ` : '';

    const confirmButton = {
      type: 2,
      style: 3,
      label: this.client.t('house.btn_confirm_presence', {}),
      custom_id: 'house_call_confirm',
    };

    const message = cfg.call.message ?? {};
    const body = {
      components: [{ type: 1, components: [confirmButton] }],
      allowed_mentions: { roles: cfg.call.notifyRoleId ? [cfg.call.notifyRoleId] : [] },
    };

    if (message.type === 'embed' && message.embed) {
      body.content = mention || undefined;
      body.embeds  = [message.embed];
    } else if (message.type === 'normal' && message.content) {
      body.content = `${mention}${message.content}`;
    } else {
      body.content = `${mention}${this.client.t('house.auto_call_message', {})}`;
    }

    return body;
  }

  async sendCallMessage(cfg) {
    if (!cfg.call.channelId) return;
    const body = this.buildCallMessagePayload(cfg);
    await DiscordRequest(`/channels/${cfg.call.channelId}/messages`, {
      method: 'POST', body,
    }).catch(err => console.error('[House/CallScheduler] Falha ao enviar mensagem da chamada:', err?.message));
  }

  async runScheduledCall(guildId) {
    const cfg = await this.config.get(guildId);
    if (!cfg?.enabled || !cfg.call?.schedule?.enabled) return;
    if (!(await this.premium.hasSubscription(guildId))) return;
    if (!cfg.call.channelId) return;

    const existing = await this.call.getOpen(guildId);
    if (existing) return;

    const started = await this.call.start(guildId, this.client.clientId ?? 'system', cfg.call.channelId, cfg.call.duration);
    if (!started.ok) return;

    await this.history.log(guildId, { action: 'chamada_iniciada', detail: this.client.t('house.detail_call_auto_started', {}) });

    await this.sendCallMessage(cfg);
    await this.syncCallTimeout(guildId);
  }

  async startManualCall(guildId, startedBy, cfg) {
    if (!cfg.call.channelId) return { ok: false, reason: 'canal_nao_definido' };

    const started = await this.call.start(guildId, startedBy, cfg.call.channelId, cfg.call.duration);
    if (!started.ok) return started;

    await this.history.log(guildId, { action: 'chamada_iniciada', staffId: startedBy, detail: 'Manual' });

    await this.sendCallMessage(cfg);
    await this.syncCallTimeout(guildId);

    return started;
  }

  async syncInactivityTask(guildId, cfg) {
    const inactivity = cfg?.call?.inactivity;

    if (!inactivity?.enabled || !inactivity.days) {
      return this.cancelInactivityTask(guildId);
    }

    await this.tasks.createHouseInactivityCheck({ guildId, hour: INACTIVITY_CHECK_HOUR, minute: 0 });
  }

  async cancelInactivityTask(guildId) {
    await this.tasks.cancelHouseInactivityCheck(guildId);
  }

  async runInactivityCheck(guildId) {
    const cfg = await this.config.get(guildId);
    if (!cfg?.enabled || !cfg.call?.inactivity?.enabled) return;

    const days = Number(cfg.call.inactivity.days) || 0;
    if (days <= 0) return;

    const punish   = cfg.call.inactivity.punish !== false;
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;

    const occupied = await this.characters.listOccupied(guildId);
    const results   = { checked: 0, punished: [], warned: [] };

    let canKick = punish;
    if (punish) {
      const perms = await getPerm({ bot: true, guildId, client: this.client }).catch(() => []);
      canKick = !!perms?.includes('KICK_MEMBERS');
    }

    for (const character of occupied) {
      const userId = character.currentUserId;
      if (!userId) continue;

      const activity = await this.activity.get(guildId, userId);
      const lastSeen = activity.lastActivityAt ?? character.chosenAt ?? character.createdAt ?? new Date();
      if (lastSeen.getTime() > threshold) continue;

      results.checked += 1;

      if (punish && canKick) {
        await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' }).catch(() => {});
        await this.history.log(guildId, {
          action: 'membro_expulso_inatividade', userId,
          detail: this.client.t('house.detail_inactive_kicked', { days }),
        });
        results.punished.push(userId);
      } else {
        await this.history.log(guildId, {
          action: 'membro_inativo_detectado', userId,
          detail: punish && !canKick
            ? this.client.t('house.detail_inactive_warned_no_perm', { days })
            : this.client.t('house.detail_inactive_warned', { days }),
        });
        results.warned.push(userId);
      }
    }

    if (results.checked > 0) await this._sendCallLog(guildId, cfg, results, days, punish);
    return results;
  }

  async _sendCallLog(guildId, cfg, results, days, punish) {
    const channelId = cfg.call?.logChannelId;
    if (!channelId) return;
    if (!(await this.premium.hasSubscription(guildId))) return;

    const lines = [];
    if (results.punished.length) lines.push(this.client.t('house.inactivity_log_kicked_line', { count: results.punished.length, mentions: results.punished.map(id => `<@${id}>`).join(', ') }));
    if (results.warned.length)   lines.push(this.client.t('house.inactivity_log_warned_line', { count: results.warned.length, mentions: results.warned.map(id => `<@${id}>`).join(', ') }));

    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          title: this.client.t('house.inactivity_log_title', { days }),
          description: lines.join('\n') || this.client.t('house.inactivity_log_no_members', {}),
          color: punish ? 0xED4245 : 0xFEE75C,
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      },
    }).catch(err => console.warn('[House/CallScheduler] Falha ao enviar log de inatividade:', err?.message));
  }

  async logCallClosed(guildId, cfg, stats, closedBy) {
    const channelId = cfg?.call?.logChannelId;
    if (!channelId) return;
    if (!(await this.premium.hasSubscription(guildId))) return;

    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          title: this.client.t('house.call_closed_log_title', {}),
          description: this.client.t('house.call_closed_log_desc', {
            present: stats.present, absent: stats.absent, total: stats.total, percent: stats.percent, closedBy: closedBy || null,
          }),
          color: ACCENT,
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      },
    }).catch(err => console.warn('[House/CallScheduler] Falha ao enviar log de chamada:', err?.message));
  }
}

module.exports = CallScheduler;
