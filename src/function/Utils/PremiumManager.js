const UserGlobalDb = require("../../Mongodb/userglobal.js");
const {GuildDb} = require("../../Mongodb/guild.js");
const PremiumKey = require("../../Mongodb/premiumKey.js");
const { getPlan, isValidPlan, DEFAULT_PLAN } = require("./PremiumPlans.js");

class PremiumManager {

  
  async addUserPremium(userId, dias, planId = DEFAULT_PLAN) {

    const tempoMs = dias * 86400000;
    const plan = isValidPlan(planId) ? planId : DEFAULT_PLAN;

    let user = await UserGlobalDb.findOne({ userId });

    if (!user)
      user = await UserGlobalDb.create({ userId });

    const agora = Date.now();

    if (user.premium > agora)
      user.premium += tempoMs;
    else
      user.premium = agora + tempoMs;

    // Se já tinha um plano melhor ativo, não rebaixa por engano (ex:
    // resgatar uma key de Nova Estrela enquanto já é Constellation).
    const planoAtual = user.premium_plan && isValidPlan(user.premium_plan) ? getPlan(user.premium_plan) : null;
    const planoNovo = getPlan(plan);
    if (!planoAtual || planoNovo.order >= planoAtual.order) {
      user.premium_plan = plan;
    }

    await user.save();

    return {
      status: true,
      expireAt: user.premium,
      plan: user.premium_plan
    };
  }

  /**
   * "função ponte": resolve tudo que depende do PLANO do
   * usuário (não só se tem premium ou não). É a fonte única de verdade
   * pra limites/benefícios; `getUserPremium()` abaixo é mantido como
   * wrapper fino por cima dela, pra não quebrar os call sites existentes
   * que só olham `.status`/`.tempo`/`.expireAt`.
   */
  async getUserPlan(userId) {

    const user = await UserGlobalDb.findOne({ userId });

    if (!user || user.premium === 0)
      return { status: false, planId: null, plan: null };

    const agora = Date.now();

    if (user.premium > agora) {
      const planId = isValidPlan(user.premium_plan) ? user.premium_plan : DEFAULT_PLAN;
      return {
        status: true,
        tempo: user.premium - agora,
        expireAt: user.premium,
        planId,
        plan: getPlan(planId)
      };
    }

    user.premium = 0;
    user.premium_plan = null;
    await user.save();

    return { status: false, planId: null, plan: null };
  }

  // Mantido por compatibilidade — mesmo formato de retorno de antes
  // (status/tempo/expireAt), só que agora por baixo dos panos passa pela
  // função ponte `getUserPlan()`.
  async getUserPremium(userId) {
    return this.getUserPlan(userId);
  }

  async addGuildPremium(guildId, userId) {

    const user = await UserGlobalDb.findOne({ userId });
    if (!user) return { status: false, motivo: "Usuário não encontrado" };

    const premium = await this.getUserPlan(userId);
    if (!premium.status)
      return { status: false, motivo: "Sem premium ativo" };

    if (!user.premium_guilds)
      user.premium_guilds = [];


    // mais de um número flat igual pra todo mundo.
    const limite = premium.plan.guildLimit;

    if (user.premium_guilds.length >= limite) {
      return {
        status: false,
        motivo: `Limite do plano ${premium.plan.name} atingido (${limite})`
      };
    }

    let guild = await GuildDb.findOne({ guildId });

    if (!guild)
      guild = await GuildDb.create({ guildId });

    const expireAt = Date.now() + premium.tempo;

    guild.premiumUser = userId;
    guild.premiumTime = expireAt;
    guild.premiumPlan = premium.planId; // servidor herda o plano de quem ativou

    await guild.save();

    const exists = user.premium_guilds.find(g => g.guildId === guildId);

    if (exists) {
      exists.expireAt = expireAt;
    } else {
      user.premium_guilds.push({
        guildId,
        expireAt
      });
    }

    await user.save();

    return {
      status: true,
      expireAt
    };
  }

  async addGuildPremiumDirect(guildId, dias, planId = DEFAULT_PLAN) {

    let guild = await GuildDb.findOne({ guildId });

    if (!guild)
      guild = await GuildDb.create({ guildId });

    const tempoMs = dias * 86400000;
    const agora = Date.now();

    if (guild.premiumTime > agora)
      guild.premiumTime += tempoMs;
    else
      guild.premiumTime = agora + tempoMs;

    guild.premiumPlan = isValidPlan(planId) ? planId : DEFAULT_PLAN;

    await guild.save();

    return {
      status: true,
      expireAt: guild.premiumTime
    };
  }

  async getGuildPremium(guildId) {

    const guild = await GuildDb.findOne({ guildId });

    if (!guild || !guild.premiumTime)
      return { status: false };

    const agora = Date.now();

    if (guild.premiumTime <= agora) {

      guild.premiumUser = null;
      guild.premiumTime = 0;
      guild.premiumPlan = null;
      await guild.save();

      return { status: false };
    }

    const planId = isValidPlan(guild.premiumPlan) ? guild.premiumPlan : DEFAULT_PLAN;

    return {
      status: true,
      tempo: guild.premiumTime - agora,
      expireAt: guild.premiumTime,
      userId: guild.premiumUser,
      planId,
      plan: getPlan(planId)
    };
  }

  async removeGuildPremium(guildId, userId) {

    const guild = await GuildDb.findOne({ guildId });
    const user = await UserGlobalDb.findOne({ userId });

    if (!guild || !user)
      return { status: false };

    guild.premiumUser = null;
    guild.premiumTime = 0;
    guild.premiumPlan = null;

    await guild.save();

    user.premium_guilds = user.premium_guilds
      .filter(g => g.guildId !== guildId);

    await user.save();

    return { status: true };
  }

  async listUserGuilds(userId) {

    const user = await UserGlobalDb.findOne({ userId });

    if (!user || !user.premium_guilds)
      return [];

    const agora = Date.now();

    const valid = user.premium_guilds.filter(g => g.expireAt > agora);

    user.premium_guilds = valid;
    await user.save();

    return valid;
  }

  async redeemKey(userId, guildId, code) {

    const key = await PremiumKey.findOne({ code });

    if (!key)
      return { status: false, motivo: "Key inválida" };

    if (key.used)
      return { status: false, motivo: "Key já utilizada" };

    if (key.type === "USER") {

      const dias = key.duration / 86400000;
      await this.addUserPremium(userId, dias, key.plan);

    } else if (key.type === "GUILD") {

      const dias = key.duration / 86400000;
      await this.addGuildPremiumDirect(guildId, dias, key.plan);
    }

    key.used = true;
    key.usedBy = userId;
    key.usedAt = Date.now();

    await key.save();

    return { status: true, plan: getPlan(key.plan) };
  }

  
  async createKey(type, dias, planId = DEFAULT_PLAN) {

    const crypto = require("crypto");

    const code = "LUA-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    await PremiumKey.create({
      code,
      type,
      plan: isValidPlan(planId) ? planId : DEFAULT_PLAN,
      duration: dias * 86400000
    });

    return code;
  }
}

module.exports = new PremiumManager();
