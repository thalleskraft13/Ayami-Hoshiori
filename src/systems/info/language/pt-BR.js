"use strict";

module.exports = [
  { id: "title_geral", render: () => "Ayami Hoshiori — Informações" },
  { id: "title_performance", render: () => "Ayami Hoshiori — Performance" },
  { id: "title_premium", render: () => "Ayami Hoshiori — Premium" },
  { id: "title_clusters", render: () => "Ayami Hoshiori — Clusters & Shards" },
  { id: "title_clusters_error", render: () => "Ayami Hoshiori — Clusters" },
  { id: "title_versoes", render: () => "Ayami Hoshiori — Versões" },
  { id: "creator_label", render: () => "Criador" },

  { id: "body_geral", render: (ctx) =>
    `> 🌐 **Servidores (total cluster):** \`${ctx.totalGuilds}\`\n` +
    `> 👥 **Usuários (DB):** \`${ctx.totalUsersDB}\`\n\n` +
    `> ⏳ **Uptime:** \`${ctx.uptime}\`\n` +
    `> 🟢 **Node:** \`${ctx.nodeVersion}\`` },

  { id: "ping_error", render: () => "Erro" },
  { id: "body_performance", render: (ctx) =>
    `> 🏓 **Latência API:** \`${ctx.ping}ms\`\n\n` +
    `> 🧠 **Heap usado:** \`${ctx.heapUsed} MB\`\n` +
    `> 📦 **Heap total:** \`${ctx.heapTotal} MB\`` },

  { id: "premium_active", render: () => "Ativo ✅" },
  { id: "premium_inactive", render: () => "Inativo ❌" },
  { id: "body_premium", render: (ctx) =>
    `> ⭐ **Seu premium:** \`${ctx.premiumStatus}\`\n\n` +
    `> 👥 **Usuários premium:** \`${ctx.totalPremium}\`\n` +
    `> 🌐 **Servidores premium:** \`${ctx.guildsPremium}\`` },

  { id: "clusters_error_desc", render: () => "Não foi possível obter os dados dos clusters agora. Tente novamente!" },
  { id: "no_shards", render: () => "Sem shards" },
  { id: "body_clusters", render: (ctx) =>
    `> 📊 **Clusters:** \`${ctx.numClusters}\`\n` +
    `> 📡 **Shards:** \`${ctx.totalShards}\`\n` +
    `> 🏓 **Ping médio:** \`${ctx.avgPing}ms\`` },

  { id: "versions_label", render: (ctx) => `**Versões do sistema atual:**\n${ctx.versionLines}` },

  { id: "btn_add", render: () => "Adicionar Ayami" },
  { id: "btn_server", render: () => "Servidor Oficial" },
  { id: "select_placeholder", render: () => "✨ Escolha uma categoria~" },
  { id: "opt_geral", render: () => "Geral" },
  { id: "opt_performance", render: () => "Performance" },
  { id: "opt_premium", render: () => "Premium" },
  { id: "opt_clusters", render: () => "Clusters & Shards" },
  { id: "opt_versoes", render: () => "Versões" },
];
