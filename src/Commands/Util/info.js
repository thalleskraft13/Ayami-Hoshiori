const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const PremiumManager = require("../../function/Utils/PremiumManager.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");
const GuildDb = require("../../Mongodb/guild.js");
const os = require("os");

module.exports = {
  data: {
    name: "botinfo",
    description: "Informações detalhadas do bot"
  },

  async execute(interaction, client) {

    const userId = interaction.member.user.id;
    const botData = await DiscordRequest("/users/@me", { method: "GET" });

    const formatTempo = (ms) => {
      const s = Math.floor(ms / 1000) % 60;
      const m = Math.floor(ms / (1000 * 60)) % 60;
      const h = Math.floor(ms / (1000 * 60 * 60)) % 24;
      const d = Math.floor(ms / (1000 * 60 * 60 * 24));
      return `${d}d ${h}h ${m}m ${s}s`;
    };

    // ✅ Apenas 1 request leve
    const guilds = await DiscordRequest("/users/@me/guilds", { method: "GET" });
    const totalGuilds = guilds.length;

    const botAvatar = botData.avatar
      ? `https://cdn.discordapp.com/avatars/${botData.id}/${botData.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;

    const buildEmbed = async (page) => {

      const uptime = formatTempo(process.uptime() * 1000);
      const mem = process.memoryUsage();
      const premium = await PremiumManager.getUserPremium(userId);
      const totalUsersDB = await UserGlobalDb.countDocuments();

      const baseDescription =
        `🤖 ${botData.username}\n\n` +
        `👑 Criador: [Thalles](https://discord.com/users/1438170698580361287)\n`;

      if (page === "geral") {
        return new MessageEmbed()
          .setTitle("Bot Info - Geral")
          .setThumbnail(botAvatar)
          .setDescription(
            baseDescription +
            `\n🌐 Servidores: ${totalGuilds}\n` +
            `📦 Usuários globais (DB): ${totalUsersDB}\n\n` +
            `⏳ Uptime: ${uptime}\n` +
            `🟢 Node: ${process.version}`
          )
          .randomColor()
          .build();
      }

      if (page === "sistema") {
        return new MessageEmbed()
          .setTitle("Bot Info - Sistema")
          .setThumbnail(botAvatar)
          .setDescription(
            baseDescription +
            `\nSistema: ${os.type()} ${os.release()}\n` +
            `Plataforma: ${os.platform()}\n` +
            `Arquitetura: ${os.arch()}\n\n` +
            `CPU: ${os.cpus()[0].model}\n` +
            `Cores: ${os.cpus().length}\n\n` +
            `RAM total: ${(os.totalmem() / 1024 / 1024).toFixed(2)} MB\n` +
            `RAM livre: ${(os.freemem() / 1024 / 1024).toFixed(2)} MB`
          )
          .randomColor()
          .build();
      }

      if (page === "performance") {

        let ping = "N/A";

        try {
          const start = Date.now();
          await DiscordRequest("/gateway", { method: "GET" });
          ping = Date.now() - start;
        } catch {
          ping = "Erro";
        }

        return new MessageEmbed()
          .setTitle("Bot Info - Performance")
          .setThumbnail(botAvatar)
          .setDescription(
            baseDescription +
            `\nLatência API: ${ping} ms\n` +
            `PID: ${process.pid}\n\n` +
            `Heap usado: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
            `Heap total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB\n` +
            `RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`
          )
          .randomColor()
          .build();
      }

      if (page === "database") {

        const start = Date.now();
        await UserGlobalDb.countDocuments();
        const tempo = Date.now() - start;

        return new MessageEmbed()
          .setTitle("Bot Info - Banco de Dados")
          .setThumbnail(botAvatar)
          .setDescription(
            baseDescription +
            `\nStatus: conectado\n` +
            `Tempo de resposta: ${tempo} ms`
          )
          .randomColor()
          .build();
      }

      if (page === "premium") {

        const agora = Date.now();
        const premiumUsers = await UserGlobalDb.find({ premium: { $gt: agora } });
        const totalPremium = premiumUsers.length;

        const guildsPremium = await GuildDb.countDocuments({
          premiumUser: { $ne: null }
        });

        return new MessageEmbed()
          .setTitle("Bot Info - Premium")
          .setThumbnail(botAvatar)
          .setDescription(
            baseDescription +
            `\nPremium ativo (você): ${premium.status ? "sim" : "nao"}\n\n` +
            `Usuários premium: ${totalPremium}\n` +
            `Servidores premium: ${guildsPremium}`
          )
          .randomColor()
          .build();
      }

      if (page === "stats") {
        return new MessageEmbed()
          .setTitle("Bot Info - Estatísticas")
          .setThumbnail(botAvatar)
          .setDescription(
            baseDescription +
            `\n🌐 Total de Servidores: ${totalGuilds}\n` +
            `⚙️ Comandos: ${client.commands.size}\n` +
            `🧠 Memória: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
            `🆔 PID: ${process.pid}`
          )
          .randomColor()
          .build();
      }

    };

    const select = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: "Escolha uma categoria",
        options: [
          { label: "Geral", value: "geral" },
          { label: "Sistema", value: "sistema" },
          { label: "Performance", value: "performance" },
          { label: "Banco de Dados", value: "database" },
          { label: "Premium", value: "premium" },
          { label: "Estatísticas", value: "stats" }
        ]
      },
      funcao: async (btn) => {

        const value = btn.data.values[0];
        const embed = await buildEmbed(value);

        await DiscordRequest(`/interactions/${btn.id}/${btn.token}/callback`, {
          method: "POST",
          body: {
            type: 7,
            data: { embeds: [embed] }
          }
        });
      }
    });

    const embedInicial = await buildEmbed("geral");

    const btnAdd = {
      type: 2,
      style: 5,
      label: "Adicionar Arlecchino",
      url: "https://discord.com/oauth2/authorize?client_id=1441027871069048902&permissions=6755522653448304&integration_type=0&scope=bot+applications.commands"
    };

    const btnGithub = {
      type: 2,
      style: 5,
      label: "GitHub Oficial",
      url: "https://github.com/thalleskraft13/Arlecchino"
    };

    const btnServer = {
      type: 2,
      style: 5,
      label: "Servidor Oficial",
      url: "https://discord.gg/RBVSUyNZKv"
    };

    await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: "POST",
      body: {
        type: 4,
        data: {
          embeds: [embedInicial],
          components: [
            { type: 1, components: [select] },
            { type: 1, components: [btnAdd, btnGithub, btnServer] }
          ]
        }
      }
    });

  }
};