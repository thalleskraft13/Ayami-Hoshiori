const PremiumManager = require("./Utils/PremiumManager.js");
const GuildDb = require("../Mongodb/guild.js");
const UserGlobalDb = require("../Mongodb/userglobal.js");
const sendDm = require("./Utils/sendDm.js")
const MessageEmbed = require("./Messages/EmbedBuild.js")
const STAFF = ["1438170698580361287"];

class NextMessageCollector {

  constructor() {
    this.waiting = new Map();
  }

  isStaff(userId) {
    return STAFF.includes(userId);
  }

  async send(channelId, content) {
    const DiscordRequest = require("./DiscordRequest");

    return DiscordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: { content }
    });
  }

  async handleCommand(message) {

    if (!message.content.startsWith("!")) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args[0];

    const userId = message.author.id;
    const channelId = message.channel_id;

    if (!this.isStaff(userId)) return;

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

  handle(payload) {

    if (payload.t !== "MESSAGE_CREATE") return;

    const message = payload.d;

    const CLIENT_ID = process.env.CLIENT_ID;

    if (message.author.id === CLIENT_ID) return;
    
(async () => {

  const userId = message.author.id;

  let user = await UserGlobalDb.findOne({ userId });

  if (!user) {
    user = new UserGlobalDb({
      userId,
      rankaventureiro: {
        nivelAtual: 0,
        xpTotal: 0,
        xpRestante: 1000
      }
    });
  }

  if (!user.rankaventureiro) {
    user.rankaventureiro = {
      nivelAtual: 0,
      xpTotal: 0,
      xpRestante: 1000
    };
  }

  const MAX_LEVEL = 60;

  const nivelAntes = user.rankaventureiro.nivelAtual;

 
  user.rankaventureiro.xpTotal += 5;

  let nivel = user.rankaventureiro.nivelAtual;
  let xpTotal = user.rankaventureiro.xpTotal;

  
  while (nivel < MAX_LEVEL) {
    const xpNecessaria = (nivel + 1) * 1000;

    if (xpTotal >= xpNecessaria) {
      nivel++;
    } else {
      break;
    }
  }

  user.rankaventureiro.nivelAtual = nivel;
  if (nivel > nivelAntes) {

  const levelsGanhos =
    nivel - nivelAntes;

  const recompensaGiros =
    levelsGanhos * 5;

  const recompensaPrimogemas =
    recompensaGiros * 160;

  user.primogemas.atm +=
    recompensaPrimogemas;

  if (
    !Array.isArray(
      user.primogemas.transacoes
    )
  ) {
    user.primogemas.transacoes = [];
  }

  user.primogemas.transacoes.push({
    type: "adventure_rank_reward",
    value: recompensaPrimogemas,
    rolls: recompensaGiros,
    old_level: nivelAntes,
    new_level: nivel,
    date: Date.now()
  });
}

  if (nivel >= MAX_LEVEL) {
    user.rankaventureiro.nivelAtual = MAX_LEVEL;
    user.rankaventureiro.xpRestante = 0;
  } else {
    const xpProximoNivel = (nivel + 1) * 1000;
    user.rankaventureiro.xpRestante = xpProximoNivel - xpTotal;
  }

  await user.save();

 
  if (nivel > nivelAntes && user.dmNotificacoes) {

    const subiuQuantos = nivel - nivelAntes;
    let embed = new MessageEmbed();
    let userData = await DiscordRequest(`/users/${userId}`, {
        method: 'GET'
      });
      
      embed.setDescription(`Hm... então você evoluiu.

Do Rank de Aventureiro #${nivelAntes} para #${nivelAntes + 1}.
Nada mal. Você começa a entender o peso do próprio crescimento.

Como reconhecimento pelo avanço, a Casa da Lareira concedeu a você 5 giros.
Use-os com sabedoria… ou desperdice-os como tantos outros fazem.

Sua experiência atual é ${user.rankaventureiro.xpTotal}XP.
Ainda faltam ${user.rankaventureiro.xpRestante}XP para alcançar o Rank de Aventureiro #${nivel + 1}.

Não pense que isso é o suficiente.
O verdadeiro valor não está no número… mas no quanto você suporta para alcançá-lo.

Continue.

Eu estarei observando.`);
embed.setColor("Red");
embed.setTitle("Novo Rank de Aventureiro!");
embed.setThumbnail(getAvatarURL(userData))

try {
await sendDm(userId,{
  embeds: [embed.build()]
})
} catch (err){
  return;
}
    

    
  }

})();


    if (
      message.content.includes(`<@${CLIENT_ID}>`) ||
      message.content.includes(`<@!${CLIENT_ID}>`)
    ) {

      const DiscordRequest = require("./DiscordRequest");

      return DiscordRequest(
  `/channels/${message.channel_id}/messages`,
  {
    method: "POST",

    body: {
      content: `<@${message.author.id}> | Use </ajuda:0> para visualizar todos os comandos e sistemas disponíveis.\n-# Continue crescendo. Eu observo cada passo seu…`
    }
  }
);
    }
   

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


function getAvatarURL(user) {

  if (!user.avatar)
    return `https://cdn.discordapp.com/embed/avatars/0.png`;

  const isGif = user.avatar.startsWith("a_");
  const extension = isGif ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=1024`;
}

module.exports = NextMessageCollector;