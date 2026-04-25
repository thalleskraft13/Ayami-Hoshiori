const PremiumManager = require("./Utils/PremiumManager");
const GuildDb = require("../Mongodb/guild");
const UserGlobalDb = require("../Mongodb/userglobal");

const STAFF = ["1438170698580361287"];

class NextMessageCollector {

  constructor() {
    this.waiting = new Map();
  }

  /* ===============================
     STAFF CHECK
  =============================== */
  isStaff(userId) {
    return STAFF.includes(userId);
  }

  /* ===============================
     SEND MESSAGE
  =============================== */
  async send(channelId, content) {

    const DiscordRequest = require("./DiscordRequest");

    return DiscordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: { content }
    });
  }

  /* ===============================
     COMMAND HANDLER
  =============================== */
  async handleCommand(message) {

    if (!message.content.startsWith("!")) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args[0];

    const userId = message.author.id;
    const channelId = message.channel_id;

    if (!this.isStaff(userId)) return;

    /* ===============================
       USER PREMIUM ADD
    =============================== */
    if (cmd === "useraddpremium") {

      const targetId = args[1];
      const days = Number(args[2]);

      if (!targetId || !days) {
        return this.send(channelId, "❌ Uso: `!useraddpremium [ID] [DIAS]`");
      }

      await PremiumManager.addUserPremium(targetId, days);

      return this.send(
        channelId,
        `✅ Premium adicionado para <@${targetId}> por **${days} dias**`
      );
    }

    /* ===============================
       USER PREMIUM REMOVE
    =============================== */
    if (cmd === "userremovepremium") {

      const targetId = args[1];

      if (!targetId) {
        return this.send(channelId, "❌ Uso: `!userremovepremium [ID]`");
      }

      await PremiumManager.removeUserPremium(targetId);

      return this.send(
        channelId,
        `❌ Premium removido de <@${targetId}>`
      );
    }

    /* ===============================
       GUILD PREMIUM ADD
    =============================== */
    if (cmd === "guildaddpremium") {

      const targetUserId = args[1];
      const guildId = args[2];

      if (!targetUserId || !guildId) {
        return this.send(channelId, "❌ Uso: `!guildaddpremium [USER_ID] [GUILD_ID]`");
      }

      const result = await PremiumManager.addGuildPremium(guildId, targetUserId);

      if (!result.status) {
        return this.send(channelId, "❌ Usuário não tem premium ativo.");
      }

      return this.send(
        channelId,
        `🏰 Servidor **${guildId}** agora é premium`
      );
    }

    /* ===============================
       GUILD PREMIUM REMOVE
    =============================== */
    if (cmd === "guildremovepremium") {

      const guildId = args[1];

      if (!guildId) {
        return this.send(channelId, "❌ Uso: `!guildremovepremium [GUILD_ID]`");
      }

      await PremiumManager.removeGuildPremium(guildId);

      return this.send(
        channelId,
        `❌ Premium removido do servidor ${guildId}`
      );
    }
  }

  /* ===============================
     MESSAGE HANDLER
  =============================== */
  handle(payload) {

    if (payload.t !== "MESSAGE_CREATE") return;

    const message = payload.d;

    // comandos
    this.handleCommand(message);

    const key = `${message.channel_id}_${message.author.id}`;
    const data = this.waiting.get(key);

    if (!data) return;

    if (Date.now() > data.expires) {
      this.waiting.delete(key);
      return;
    }

    clearTimeout(data.timeout);
    this.waiting.delete(key);

    data.resolve(message);
  }

  /* ===============================
     WAIT MESSAGE
  =============================== */
  wait({ channelId, userId, time = 60000 }) {

    return new Promise((resolve, reject) => {

      const key = `${channelId}_${userId}`;

      const timeout = setTimeout(() => {
        this.waiting.delete(key);
        reject(new Error("Tempo esgotado"));
      }, time);

      this.waiting.set(key, {
        resolve,
        expires: Date.now() + time,
        timeout
      });
    });
  }
}

module.exports = NextMessageCollector;