const UserGlobalDb = require("../../Mongodb/userglobal.js");
const GuildDb = require("../../Mongodb/guild.js");

class PremiumManager {

  // =========================
  // USER PREMIUM
  // =========================

  async addUserPremium(userId, dias) {
    const tempoMs = dias * 24 * 60 * 60 * 1000;

    let user = await UserGlobalDb.findOne({ userId });

    if (!user) {
      user = await UserGlobalDb.create({ userId });
    }

    const agora = Date.now();

    if (user.premium > agora) {
      user.premium += tempoMs;
    } else {
      user.premium = agora + tempoMs;
    }

    await user.save();

    return user.premium;
  }

  async getUserPremium(userId) {
    const user = await UserGlobalDb.findOne({ userId });

    if (!user || user.premium === 0) {
      return { status: false };
    }

    const agora = Date.now();

    if (user.premium > agora) {
      return {
        status: true,
        tempo: user.premium - agora
      };
    } else {
      // expirou → limpa
      user.premium = 0;
      await user.save();

      return { status: false };
    }
  }

  // =========================
  // GUILD PREMIUM
  // =========================

  async addGuildPremium(guildId, userId) {
    const userPremium = await this.getUserPremium(userId);

    if (!userPremium.status) {
      return { status: false, motivo: "Usuário sem premium ativo" };
    }

    let guild = await GuildDb.findOne({ guildId });

    if (!guild) {
      guild = await GuildDb.create({ guildId });
    }

    guild.premiumUser = userId;
    await guild.save();

    return { status: true };
  }

  async getGuildPremium(guildId) {
    const guild = await GuildDb.findOne({ guildId });

    if (!guild || !guild.premiumUser || guild.premiumUser === "0") {
      return { status: false };
    }

    // 🔥 pega direto do user
    const userPremium = await this.getUserPremium(guild.premiumUser);

    // se expirou → limpa guild
    if (!userPremium.status) {
      guild.premiumUser = null; // ou "0" se quiser manter padrão antigo
      await guild.save();

      return { status: false };
    }

    return {
      status: true,
      tempo: userPremium.tempo,
      userId: guild.premiumUser
    };
  }
}

module.exports = new PremiumManager();