"use strict";

module.exports = [
  { id: "title_geral", render: () => "Ayami Hoshiori — Info" },
  { id: "title_performance", render: () => "Ayami Hoshiori — Performance" },
  { id: "title_premium", render: () => "Ayami Hoshiori — Premium" },
  { id: "title_clusters", render: () => "Ayami Hoshiori — Clusters & Shards" },
  { id: "title_clusters_error", render: () => "Ayami Hoshiori — Clusters" },
  { id: "title_versoes", render: () => "Ayami Hoshiori — Versions" },
  { id: "creator_label", render: () => "Creator" },

  { id: "body_geral", render: (ctx) =>
    `> 🌐 **Servers (whole cluster):** \`${ctx.totalGuilds}\`\n` +
    `> 👥 **Users (DB):** \`${ctx.totalUsersDB}\`\n\n` +
    `> ⏳ **Uptime:** \`${ctx.uptime}\`\n` +
    `> 🟢 **Node:** \`${ctx.nodeVersion}\`` },

  { id: "ping_error", render: () => "Error" },
  { id: "body_performance", render: (ctx) =>
    `> 🏓 **API Latency:** \`${ctx.ping}ms\`\n\n` +
    `> 🧠 **Heap used:** \`${ctx.heapUsed} MB\`\n` +
    `> 📦 **Heap total:** \`${ctx.heapTotal} MB\`` },

  { id: "premium_active", render: () => "Active ✅" },
  { id: "premium_inactive", render: () => "Inactive ❌" },
  { id: "body_premium", render: (ctx) =>
    `> ⭐ **Your premium:** \`${ctx.premiumStatus}\`\n\n` +
    `> 👥 **Premium users:** \`${ctx.totalPremium}\`\n` +
    `> 🌐 **Premium servers:** \`${ctx.guildsPremium}\`` },

  { id: "clusters_error_desc", render: () => "Couldn't fetch cluster data right now. Try again!" },
  { id: "no_shards", render: () => "No shards" },
  { id: "body_clusters", render: (ctx) =>
    `> 📊 **Clusters:** \`${ctx.numClusters}\`\n` +
    `> 📡 **Shards:** \`${ctx.totalShards}\`\n` +
    `> 🏓 **Average ping:** \`${ctx.avgPing}ms\`` },

  { id: "versions_label", render: (ctx) => `**Current system versions:**\n${ctx.versionLines}` },

  { id: "btn_add", render: () => "Add Ayami" },
  { id: "btn_server", render: () => "Official Server" },
  { id: "select_placeholder", render: () => "✨ Pick a category~" },
  { id: "opt_geral", render: () => "General" },
  { id: "opt_performance", render: () => "Performance" },
  { id: "opt_premium", render: () => "Premium" },
  { id: "opt_clusters", render: () => "Clusters & Shards" },
  { id: "opt_versoes", render: () => "Versions" },
];
