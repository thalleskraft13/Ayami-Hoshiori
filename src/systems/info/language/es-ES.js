"use strict";

module.exports = [
  { id: "title_geral", render: () => "Ayami Hoshiori — Información" },
  { id: "title_performance", render: () => "Ayami Hoshiori — Rendimiento" },
  { id: "title_premium", render: () => "Ayami Hoshiori — Premium" },
  { id: "title_clusters", render: () => "Ayami Hoshiori — Clusters y Shards" },
  { id: "title_clusters_error", render: () => "Ayami Hoshiori — Clusters" },
  { id: "title_versoes", render: () => "Ayami Hoshiori — Versiones" },
  { id: "creator_label", render: () => "Creador" },

  { id: "body_geral", render: (ctx) =>
    `> 🌐 **Servidores (clúster total):** \`${ctx.totalGuilds}\`\n` +
    `> 👥 **Usuarios (BD):** \`${ctx.totalUsersDB}\`\n\n` +
    `> ⏳ **Uptime:** \`${ctx.uptime}\`\n` +
    `> 🟢 **Node:** \`${ctx.nodeVersion}\`` },

  { id: "ping_error", render: () => "Error" },
  { id: "body_performance", render: (ctx) =>
    `> 🏓 **Latencia de la API:** \`${ctx.ping}ms\`\n\n` +
    `> 🧠 **Heap usado:** \`${ctx.heapUsed} MB\`\n` +
    `> 📦 **Heap total:** \`${ctx.heapTotal} MB\`` },

  { id: "premium_active", render: () => "Activo ✅" },
  { id: "premium_inactive", render: () => "Inactivo ❌" },
  { id: "body_premium", render: (ctx) =>
    `> ⭐ **Tu premium:** \`${ctx.premiumStatus}\`\n\n` +
    `> 👥 **Usuarios premium:** \`${ctx.totalPremium}\`\n` +
    `> 🌐 **Servidores premium:** \`${ctx.guildsPremium}\`` },

  { id: "clusters_error_desc", render: () => "No fue posible obtener los datos de los clusters ahora. ¡Inténtalo de nuevo!" },
  { id: "no_shards", render: () => "Sin shards" },
  { id: "body_clusters", render: (ctx) =>
    `> 📊 **Clusters:** \`${ctx.numClusters}\`\n` +
    `> 📡 **Shards:** \`${ctx.totalShards}\`\n` +
    `> 🏓 **Ping promedio:** \`${ctx.avgPing}ms\`` },

  { id: "versions_label", render: (ctx) => `**Versiones actuales del sistema:**\n${ctx.versionLines}` },

  { id: "btn_add", render: () => "Añadir a Ayami" },
  { id: "btn_server", render: () => "Servidor Oficial" },
  { id: "select_placeholder", render: () => "✨ Elige una categoría~" },
  { id: "opt_geral", render: () => "General" },
  { id: "opt_performance", render: () => "Rendimiento" },
  { id: "opt_premium", render: () => "Premium" },
  { id: "opt_clusters", render: () => "Clusters y Shards" },
  { id: "opt_versoes", render: () => "Versiones" },
];
