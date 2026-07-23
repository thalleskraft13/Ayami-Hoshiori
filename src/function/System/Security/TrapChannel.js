'use strict';

const DiscordRequest = require('../../DiscordRequest.js');


const MAX_TRACK_WINDOW_MINUTES = 30; 
const MAX_ENTRIES_PER_USER     = 40;

class TrapChannel {
  constructor(security) {
    this.security = security;
    this._recent = new Map();
  }

  _key(guildId, userId) {
    return `${guildId}:${userId}`;
  }

  trackMessage(guildId, userId, channelId, messageId) {
    const key   = this._key(guildId, userId);
    const now   = Date.now();
    const list  = this._recent.get(key) || [];
    list.push({ channelId, messageId, ts: now });

    const cutoff = now - MAX_TRACK_WINDOW_MINUTES * 60_000;
    const pruned = list.filter(e => e.ts >= cutoff).slice(-MAX_ENTRIES_PER_USER);
    this._recent.set(key, pruned);
  }

  _isIgnored(sec, userId, memberRoles, isBot) {
    const cfg = sec.trapChannel;

    if (sec.roles?.staff?.some(r => memberRoles.includes(r)))  return true;
    if (sec.roles?.immune?.some(r => memberRoles.includes(r))) return true;

    if (cfg.ignoredUsers?.includes(userId)) return true;
    if (cfg.ignoredRoles?.some(r => memberRoles.includes(r))) return true;
    if (isBot && cfg.ignoredBots?.includes(userId)) return true;

    return false;
  }

  async _deleteRecentElsewhere(guildId, userId, trapChannelId, windowMinutes) {
    const key  = this._key(guildId, userId);
    const list = this._recent.get(key) || [];
    if (!list.length) return 0;

    const windowMs = Math.min(windowMinutes || 5, MAX_TRACK_WINDOW_MINUTES) * 60_000;
    const cutoff    = Date.now() - windowMs;

    const targets = list.filter(e => e.channelId !== trapChannelId && e.ts >= cutoff);
    if (!targets.length) return 0;

    let deleted = 0;
    for (const entry of targets) {
      const hasPerm = await this.security._hasBotPerms(guildId, ["MANAGE_MESSAGES"], entry.channelId);
      if (!hasPerm) continue;
      const ok = await DiscordRequest(`/channels/${entry.channelId}/messages/${entry.messageId}`, {
        method: "DELETE"
      }).then(() => true).catch(() => false);
      if (ok) deleted++;
    }
    return deleted;
  }

  async _applyPunishment(guildId, userId, punishment) {
    if (punishment === "timeout") {
      if (!(await this.security._hasBotPerms(guildId, ["MODERATE_MEMBERS"]))) return { ok: false, missing: "MODERATE_MEMBERS" };
      const until = new Date(Date.now() + 3_600_000).toISOString(); 
      await DiscordRequest(`/guilds/${guildId}/members/${userId}`, {
        method: "PATCH", body: { communication_disabled_until: until }
      }).catch(() => {});
      return { ok: true };
    }
    if (punishment === "kick") {
      if (!(await this.security._hasBotPerms(guildId, ["KICK_MEMBERS"]))) return { ok: false, missing: "KICK_MEMBERS" };
      await DiscordRequest(`/guilds/${guildId}/members/${userId}`, { method: "DELETE" }).catch(() => {});
      return { ok: true };
    }
    if (punishment === "ban") {
      if (!(await this.security._hasBotPerms(guildId, ["BAN_MEMBERS"]))) return { ok: false, missing: "BAN_MEMBERS" };
      await DiscordRequest(`/guilds/${guildId}/bans/${userId}`, {
        method: "PUT", body: { delete_message_seconds: 0 }
      }).catch(() => {});
      return { ok: true };
    }
    return { ok: true };
  }

  async handle(guild, guildId, sec, data, memberRoles) {
    try {
      const cfg = sec.trapChannel;
      const userId    = data.author.id;
      const channelId = data.channel_id;
      const isBot     = !!data.author.bot;

      const hasDeletePerm = await this.security._hasBotPerms(guildId, ["MANAGE_MESSAGES"], channelId);
      if (hasDeletePerm) {
        await DiscordRequest(`/channels/${channelId}/messages/${data.id}`, { method: "DELETE" }).catch(() => {});
      }

      if (this._isIgnored(sec, userId, memberRoles, isBot)) return;

      const punishment = cfg.punishment || "log";
      let deletedElsewhere = 0;
      if (cfg.deleteRecentMessages) {
        deletedElsewhere = await this._deleteRecentElsewhere(
          guildId, userId, channelId, cfg.recentMessagesWindowMinutes
        );
      }

      const result = await this._applyPunishment(guildId, userId, punishment);

      if (!cfg.history) cfg.history = [];
      cfg.history.push({
        timestamp: Date.now(),
        userId,
        username: data.author.username || userId,
        action: punishment,
        deletedElsewhere
      });
      if (cfg.history.length > 200) cfg.history = cfg.history.slice(-200);

      guild.markModified("security");
      await this.security.save(guild);

      const actionLabel = {
        log: "📝 Apenas registrado",
        timeout: "⏱️ Timeout (1h)",
        kick: "👢 Kick",
        ban: "🔨 Ban"
      }[punishment] || punishment;

      let alert =
        `🪤 **Canal Armadilha acionado**\n` +
        `👤 <@${userId}> (\`${userId}\`) enviou mensagem em <#${channelId}>\n` +
        `⚡ Ação: ${actionLabel}` +
        (deletedElsewhere ? `\n🧹 ${deletedElsewhere} mensagem(ns) recente(s) apagada(s) em outros canais` : "") +
        (!hasDeletePerm ? `\n⚠️ Não consegui apagar a mensagem-gatilho — falta \`Gerenciar Mensagens\` no canal armadilha` : "") +
        (!result.ok ? `\n⚠️ Não consegui aplicar a punição \`${punishment}\` — falta permissão \`${result.missing}\`` : "");

      await this._sendAlert(guildId, sec, alert);
    } catch (err) {
      console.error("[Security] TrapChannel.handle:", err);
    }
  }

  async _sendAlert(guildId, sec, message) {
    const channelId = sec.trapChannel.logChannelId || sec.logs?.channels?.main;
    if (!channelId) return;
    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: { embeds: [{ description: message, color: 0xED4245, timestamp: new Date().toISOString() }] }
    }).catch(() => {});
  }

  async postWarningMessage(guildId, channelId) {
    const hasPerm = await this.security._hasBotPerms(guildId, ["SEND_MESSAGES", "EMBED_LINKS"], channelId);
    if (!hasPerm) return { ok: false, missing: "SEND_MESSAGES/EMBED_LINKS" };

    await DiscordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: {
        embeds: [{
          title: "🚫 Este é um Canal Armadilha.",
          description:
            "Não envie mensagens aqui.\n\n" +
            "Mensagens enviadas neste canal poderão resultar em punições automáticas.",
          color: 0xED4245
        }]
      }
    }).catch(() => {});
    return { ok: true };
  }
}

module.exports = TrapChannel;
