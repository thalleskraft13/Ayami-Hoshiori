"use strict";

module.exports = [
  { id: "title", render: (ctx) => `${ctx.emoji ?? "😄"} ¡Pong!` },
  { id: "field_ping", render: () => "🏓 Ping" },
  { id: "field_shard", render: () => "📡 Shard" },
  { id: "field_cluster", render: () => "🖥️ Clúster" },
  { id: "field_uptime", render: () => "⏳ Uptime" },
  { id: "field_memory", render: () => "💾 Memoria" },
];
