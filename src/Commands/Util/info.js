const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const PremiumManager = require("../../function/Utils/PremiumManager.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");
const GuildDb = require("../../Mongodb/guild.js");

module.exports = {
  data: {
    name: "botinfo",
    description: "Informações detalhadas do bot"
  },

  async execute(interaction, client) {

    const userId = interaction.member.user.id;
    const e = client.emoji;
    const COR = 0x7C8FFF;

    const botData = await DiscordRequest("/users/@me", { method: "GET" });

    const formatTempo = (ms) => {
      const s = Math.floor(ms / 1000) % 60;
      const m = Math.floor(ms / (1000 * 60)) % 60;
      const h = Math.floor(ms / (1000 * 60 * 60)) % 24;
      const d = Math.floor(ms / (1000 * 60 * 60 * 24));
      return `${d}d ${h}h ${m}m ${s}s`;
    };

    const guilds = await DiscordRequest("/users/@me/guilds", { method: "GET" });
    const totalGuilds = guilds.length;

    const botAvatar = botData.avatar
      ? `https://cdn.discordapp.com/avatars/${botData.id}/${botData.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;

    const buildEmbed = async (page) => {

      const uptime = formatTempo(process.uptime() * 1000);
      const mem = process.memoryUsage();
      const premium = await PremiumManager.getUserPremium(userId);

      if (page === "geral") {

        const totalUsersDB = await UserGlobalDb.countDocuments();

        return new MessageEmbed()
          .setTitle(`${e.default} Ayami Hoshiori — Informações`)
          .setThumbnail(botAvatar)
          .setDescription(
            `${e.feliz} **${botData.username}**\n\n` +
            `👑 Criador: [Thalles](https://discord.com/users/1438170698580361287)\n\n` +
            `🌐 Servidores(Na Shard): \`${totalGuilds}\`\n` +
            `👥 Usuários (DB): \`${totalUsersDB}\`\n\n` +
            `⏳ Uptime: \`${uptime}\`\n` +
            `🟢 Node: \`${process.version}\``
          )
          .setColor(COR)
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
          .setTitle(`${e.pensando} Ayami Hoshiori — Performance`)
          .setThumbnail(botAvatar)
          .setDescription(
            `${e.feliz} **${botData.username}**\n\n` +
            `👑 Criador: [Thalles](https://discord.com/users/1438170698580361287)\n\n` +
            `🏓 Latência API: \`${ping}ms\`\n\n` +
            `🧠 Heap usado: \`${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\`\n` +
            `📦 Heap total: \`${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB\``
          )
          .setColor(COR)
          .build();
      }

      if (page === "premium") {

        const agora = Date.now();
        const totalPremium = await UserGlobalDb.countDocuments({ premium: { $gt: agora } });
        const guildsPremium = await GuildDb.countDocuments({ premiumUser: { $ne: null } });

        return new MessageEmbed()
          .setTitle(`${e.carinho} Ayami Hoshiori — Premium`)
          .setThumbnail(botAvatar)
          .setDescription(
            `${e.feliz} **${botData.username}**\n\n` +
            `👑 Criador: [Thalles](https://discord.com/users/1438170698580361287)\n\n` +
            `⭐ Seu premium: \`${premium.status ? "Ativo ✅" : "Inativo ❌"}\`\n\n` +
            `👥 Usuários premium: \`${totalPremium}\`\n` +
            `🌐 Servidores premium: \`${guildsPremium}\``
          )
          .setColor(COR)
          .build();
      }

      if (page === "clusters") {

        let allStats;

        try {
          allStats = await client.requestAllStats();
        } catch {
          return new MessageEmbed()
            .setTitle(`${e.assustada} Ayami Hoshiori — Clusters`)
            .setDescription("Não foi possível obter os dados dos clusters agora. Tente novamente!")
            .setColor(COR)
            .build();
        }

        const CLUSTERS_NAME = client.CLUSTERS_NAME;
        const totalShards = allStats.reduce((acc, c) => acc + (c.shards?.length ?? 0), 0);
        const avgPing = (() => {
          const pings = allStats
            .flatMap(c => c.shards ?? [])
            .map(s => s.ping)
            .filter(p => p >= 0);
          if (!pings.length) return "?";
          return Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
        })();

        const linhasClusters = allStats.map(c => {
          if (c.error) return `**Cluster ${CLUSTERS_NAME[c.clusterId]}:** ⚠️ ${c.error}`;
          const shards = c.shards.map(s => `\`#${s.shardId}\` ${s.ping}ms`).join("  ");
          return `**Cluster ${CLUSTERS_NAME[c.clusterId]}:** ${shards || "Sem shards"}`;
        }).join("\n");

        return new MessageEmbed()
          .setTitle(`📡 Ayami Hoshiori — Clusters & Shards`)
          .setThumbnail(botAvatar)
          .setDescription(
            `${e.feliz} **${botData.username}**\n\n` +
            `👑 Criador: [Thalles](https://discord.com/users/1438170698580361287)\n\n` +
            `📊 Clusters: \`${allStats.length}\`\n` +
            `📡 Shards: \`${totalShards}\`\n` +
            `🏓 Ping médio: \`${avgPing}ms\`\n\n` +
            linhasClusters
          )
          .setColor(COR)
          .build();
      }
    };

    const select = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: "✨ Escolha uma categoria~",
        options: [
          { label: "Geral",             value: "geral",        emoji: { name: "📖" } },
          { label: "Performance",       value: "performance",  emoji: { name: "⚡" } },
          { label: "Premium",           value: "premium",      emoji: { name: "⭐" } },
          { label: "Clusters & Shards", value: "clusters",     emoji: { name: "📡" } }
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
      label: "Adicionar Ayami",
      url: "https://discord.com/oauth2/authorize?client_id=1441027871069048902&permissions=6755522653448304&integration_type=0&scope=bot+applications.commands"
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
            { type: 1, components: [btnAdd, btnServer] }
          ]
        }
      }
    });
  }
};
