'use strict';

const DiscordRequest  = require("../../function/DiscordRequest.js");
const PremiumManager  = require("../../function/Utils/PremiumManager.js");
const UserGlobalDb    = require("../../Mongodb/userglobal.js");
const {GuildDb}         = require("../../Mongodb/guild.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

/* ─────────────────────────────────────────────
   CORES DA AYAMI
   ───────────────────────────────────────────── */
const COLOR = {
  main: 0x7C8FFF,
};

/** Imagem fixa exibida no topo do painel via Media Gallery. */
const BANNER_URL = 'https://cdn.discordapp.com/attachments/1439343766505783407/1517179361545945118/148_Sem_Titulo_20260618114843.png?ex=6a3556e3&is=6a340563&hm=cb8bd3e08f7412a656f3d1c0031489c3e8dac0d9e74691c38c5fc1b55270f281';

/** Versões do sistema atual — categoria "Versões". */
const SYSTEM_VERSIONS = [
  { label: 'Ayami',         value: '3.5' },
  { label: 'Logic Builder', value: '2.3' },
  { label: 'Logic Script',  value: '1.6'},
  { label: 'Gacha',         value: '1.4' },
  { label: 'Discord API',   value: 'V10' },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS COMPONENTS V2
   (mesmo padrão usado no Logic Builder / Biblioteca)
   ═══════════════════════════════════════════════════════════ */

function cv2Text(content) {
  return { type: 10, content };
}

function cv2Divider(spacing = 1) {
  return { type: 14, divider: true, spacing };
}

/** Media Gallery (type 12) — banner/imagem decorativa. */
function cv2Gallery(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  return {
    type:  12,
    items: list.map(url => ({ media: { url }, description: null, spoiler: false }))
  };
}

function cv2Container(blocks, opts = {}) {
  return {
    type:         17,
    accent_color: opts.accentColor ?? COLOR.main,
    spoiler:      opts.spoiler ?? false,
    components:   blocks
  };
}

function cv2Flags(ephemeral = false) {
  return ephemeral ? 32768 | 64 : 32768;
}

function cv2Payload(blocks, opts = {}) {
  return {
    flags:      cv2Flags(opts.ephemeral ?? false),
    components: [cv2Container(blocks, opts)]
  };
}

function row(...components) {
  return { type: 1, components };
}

module.exports = {
  data: {
    name: "ayami-info",
    description: "Informações detalhadas do bot",
    name_localizations: { 'en-US': 'ayami-info', 'en-GB': 'ayami-info', 'es-ES': 'ayami-info' },
    description_localizations: {
      'en-US': 'Detailed bot information',
      'en-GB': 'Detailed bot information',
      'es-ES': 'Información detallada del bot',
    }
  },

  async execute(interaction, client) {

    const userId = interaction.member.user.id;
    const e = client.emoji;

    const botData = await DiscordRequest("/users/@me", { method: "GET" });

    const formatTempo = (ms) => {
      const s = Math.floor(ms / 1000) % 60;
      const m = Math.floor(ms / (1000 * 60)) % 60;
      const h = Math.floor(ms / (1000 * 60 * 60)) % 24;
      const d = Math.floor(ms / (1000 * 60 * 60 * 24));
      return `${d}d ${h}h ${m}m ${s}s`;
    };

    // antes usava DiscordRequest("/users/@me/guilds"), que só
    // devolve as guilds visíveis PRA ESSE TOKEN dentro da página default da
    // API (paginado, até 200 por chamada) — não reflete o total real do bot
    // multi-cluster. Agora agrega o cache real de cada cluster via IPC.
    const guilds = await client.getAllGuilds();
    const totalGuilds = guilds.length;

    const buildBlocks = async (page, ctx) => {

      const uptime  = formatTempo(process.uptime() * 1000);
      const mem     = process.memoryUsage();
      const premium = await PremiumManager.getUserPremium(userId);

      const header = [
        cv2Gallery(BANNER_URL),
        cv2Divider(),
      ];

      const pageHeader = (titleKey, emoji) => cv2Text(
        `# ${emoji} ${client.t(titleKey, ctx)}\n` +
        `${e.feliz} **${botData.username}**\n\n` +
        `👑 ${client.t("info.creator_label", ctx)}: [Thalles](https://discord.com/users/1438170698580361287)`
      );

      if (page === "geral") {
        const totalUsersDB = await UserGlobalDb.countDocuments();

        return [
          ...header,
          pageHeader("info.title_geral", e.default),
          cv2Divider(),
          cv2Text(client.t("info.body_geral", { ...ctx, totalGuilds, totalUsersDB, uptime, nodeVersion: process.version })),
        ];
      }

      if (page === "performance") {
        let ping = "N/A";
        try {
          const start = Date.now();
          await DiscordRequest("/gateway", { method: "GET" });
          ping = Date.now() - start;
        } catch {
          ping = client.t("info.ping_error", ctx);
        }

        return [
          ...header,
          pageHeader("info.title_performance", e.pensando),
          cv2Divider(),
          cv2Text(client.t("info.body_performance", {
            ...ctx,
            ping,
            heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
            heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2),
          })),
        ];
      }

      if (page === "premium") {
        const agora         = Date.now();
        const totalPremium  = await UserGlobalDb.countDocuments({ premium: { $gt: agora } });
        const guildsPremium = await GuildDb.countDocuments({ premiumUser: { $ne: null } });

        return [
          ...header,
          pageHeader("info.title_premium", e.carinho),
          cv2Divider(),
          cv2Text(client.t("info.body_premium", {
            ...ctx,
            premiumStatus: premium.status ? client.t("info.premium_active", ctx) : client.t("info.premium_inactive", ctx),
            totalPremium,
            guildsPremium,
          })),
        ];
      }

      if (page === "clusters") {
        let allStats;
        try {
          allStats = await client.requestAllStats();
        } catch {
          return [
            cv2Text(
              `# ${e.assustada} ${client.t("info.title_clusters_error", ctx)}\n` +
              client.t("info.clusters_error_desc", ctx)
            ),
          ];
        }

        const CLUSTERS_NAME = client.CLUSTERS_NAME;
        const totalShards   = allStats.reduce((acc, c) => acc + (c.shards?.length ?? 0), 0);
        const avgPing = (() => {
          const pings = allStats
            .flatMap(c => c.shards ?? [])
            .map(s => s.ping)
            .filter(p => p >= 0);
          if (!pings.length) return "?";
          return Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
        })();

        const noShards = client.t("info.no_shards", ctx);
        const linhasClusters = allStats.map(c => {
          if (c.error) return `**Cluster ${CLUSTERS_NAME[c.clusterId]}:** ⚠️ ${c.error}`;
          const shards = c.shards.map(s => `\`#${s.shardId}\` ${s.ping}ms`).join("  ");
          return `**Cluster ${CLUSTERS_NAME[c.clusterId]}:** ${shards || noShards}`;
        }).join("\n");

        return [
          ...header,
          pageHeader("info.title_clusters", "📡"),
          cv2Divider(),
          cv2Text(client.t("info.body_clusters", { ...ctx, numClusters: allStats.length, totalShards, avgPing })),
          cv2Divider(),
          cv2Text(linhasClusters),
        ];
      }

      if (page === "versoes") {
        const versionLines = SYSTEM_VERSIONS
          .map(v => `> 🔖 **${v.label}:** \`${v.value}\``)
          .join('\n');

        return [
          ...header,
          pageHeader("info.title_versoes", e.sria || e.default),
          cv2Divider(),
          cv2Text(client.t("info.versions_label", { ...ctx, versionLines })),
        ];
      }
    };

    const ctx = localeCtx(interaction);

    const btnAdd = {
      type: 2,
      style: 5,
      label: client.t("info.btn_add", ctx),
      url: "https://discord.com/oauth2/authorize?client_id=1441027871069048902&permissions=6755522653448304&integration_type=0&scope=bot+applications.commands"
    };

    const btnServer = {
      type: 2,
      style: 5,
      label: client.t("info.btn_server", ctx),
      url: "https://discord.gg/WjeVXJPn5p"
    };

    const select = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: client.t("info.select_placeholder", ctx),
        options: [
          { label: client.t("info.opt_geral", ctx),       value: "geral",        emoji: { name: "📖" } },
          { label: client.t("info.opt_performance", ctx), value: "performance",  emoji: { name: "⚡" } },
          { label: client.t("info.opt_premium", ctx),     value: "premium",      emoji: { name: "⭐" } },
          { label: client.t("info.opt_clusters", ctx),    value: "clusters",     emoji: { name: "📡" } },
          { label: client.t("info.opt_versoes", ctx),     value: "versoes",      emoji: { name: "🔖" } }
        ]
      },
      funcao: async (btnInteraction) => {
        const value  = btnInteraction.data.values[0];
        const btnCtx = localeCtx(btnInteraction);
        const blocks = await buildBlocks(value, btnCtx);

        await DiscordRequest(`/interactions/${btnInteraction.id}/${btnInteraction.token}/callback`, {
          method: "POST",
          body: {
            type: 7,
            data: buildFullPayload(blocks)
          }
        });
      }
    });

    /**
     * Monta o payload CV2 completo de uma página: conteúdo + select +
     * botões de link. Components V2 substitui a mensagem inteira a
     * cada resposta — não há "merge" com o que já estava lá — então
     * TODO update precisa remontar o select e os botões, ou eles
     * desaparecem (era o bug: o callback do select mandava só o
     * `blocks` da página, sem o próprio select).
     */
    const buildFullPayload = (blocks) => cv2Payload(
      [...blocks, cv2Divider(), row(select), row(btnAdd, btnServer)],
      { accentColor: COLOR.main }
    );

    const blocksIniciais = await buildBlocks("geral", ctx);

    await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: "POST",
      body: {
        type: 4,
        data: buildFullPayload(blocksIniciais)
      }
    });
  }
};
