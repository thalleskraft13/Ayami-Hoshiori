const UserGlobalDb = require("../../Mongodb/userglobal.js");
const {GuildDb} = require("../../Mongodb/guild.js");
const PremiumKey = require("../../Mongodb/premiumKey.js");
const { getPlan, isValidPlan, isPlanAtLeast, normalizePlanKey, DEFAULT_PLAN } = require("./PremiumPlans.js");

// Normaliza um planId recebido (pode vir em formato legado, minúsculo) para
// a chave canônica; se não houver plano nenhum, cai no DEFAULT_PLAN. Usado
// sempre que vamos GRAVAR um plano no banco, pra auto-curar dados antigos.
function resolveStoredPlan(rawPlanId) {
  return rawPlanId ? normalizePlanKey(rawPlanId) : DEFAULT_PLAN;
}

class PremiumManager {


  async addUserPremium(userId, dias, planId = DEFAULT_PLAN) {

    const tempoMs = dias * 86400000;
    const plan = resolveStoredPlan(planId);

    let user = await UserGlobalDb.findOne({ userId });

    if (!user)
      user = await UserGlobalDb.create({ userId });

    const agora = Date.now();

    if (user.premium > agora)
      user.premium += tempoMs;
    else
      user.premium = agora + tempoMs;

    // premiumExpiresAt é o campo canônico lido pelo site (config/premiumPlans.js
    // #resolveActivePlan) — mantido sempre igual a `premium` pra não haver
    // divergência entre o que o bot e o site enxergam.
    user.premiumExpiresAt = user.premium;

    // Se já tinha um plano melhor ativo, não rebaixa por engano (ex:
    // resgatar uma key de Nova Estrela enquanto já é Constellation).
    const planoAtual = user.premiumPlan && isValidPlan(user.premiumPlan) ? getPlan(user.premiumPlan) : null;
    const planoNovo = getPlan(plan);
    if (!planoAtual || planoNovo.order >= planoAtual.order) {
      user.premiumPlan = plan;
    }

    await user.save();

    return {
      status: true,
      expireAt: user.premium,
      plan: user.premiumPlan
    };
  }

  /**
   * Remove o premium de um usuário imediatamente (não espera expirar).
   * ⚠️ Método que não existia antes — `!userremovepremium` (ver
   * MessageCollectorManager.js) chamava isso e quebrava com TypeError.
   */
  async removeUserPremium(userId) {

    const user = await UserGlobalDb.findOne({ userId });
    if (!user) return { status: false, motivo: "Usuário não encontrado" };

    user.premium = 0;
    user.premiumExpiresAt = 0;
    user.premiumPlan = null;

    await user.save();

    return { status: true };
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
      const planId = resolveStoredPlan(user.premiumPlan);
      return {
        status: true,
        tempo: user.premium - agora,
        expireAt: user.premium,
        planId,
        plan: getPlan(planId)
      };
    }

    user.premium = 0;
    user.premiumExpiresAt = 0;
    user.premiumPlan = null;
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

    guild.premiumPlan = resolveStoredPlan(planId);

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

    const planId = resolveStoredPlan(guild.premiumPlan);

    return {
      status: true,
      tempo: guild.premiumTime - agora,
      expireAt: guild.premiumTime,
      userId: guild.premiumUser,
      planId,
      plan: getPlan(planId)
    };
  }

  /**
   * Remove o premium de um servidor imediatamente.
   *
   * `userId` é opcional: quando não informado (ex.: comando administrativo
   * `!guildremovepremium [GUILD_ID]`, que só tem o guildId), remove o
   * premium do servidor mesmo sem saber quem foi o usuário que o concedeu —
   * antes esse caminho silenciosamente não fazia nada porque o método
   * exigia os dois parâmetros e retornava `status: false` sem limpar nada.
   */
  async removeGuildPremium(guildId, userId = null) {

    const guild = await GuildDb.findOne({ guildId });
    if (!guild) return { status: false, motivo: "Servidor não encontrado" };

    const donoAnterior = userId || guild.premiumUser;

    guild.premiumUser = null;
    guild.premiumTime = 0;
    guild.premiumPlan = null;

    await guild.save();

    if (donoAnterior) {
      const user = await UserGlobalDb.findOne({ userId: donoAnterior });
      if (user && Array.isArray(user.premium_guilds)) {
        user.premium_guilds = user.premium_guilds.filter(g => g.guildId !== guildId);
        await user.save();
      }
    }

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
      plan: resolveStoredPlan(planId),
      duration: dias * 86400000
    });

    return code;
  }
}

module.exports = new PremiumManager();
