"use strict";

module.exports = [
  { id: "invalid_time", render: () => "❌ Tempo inválido. Use: 10s, 5m, 1h, 2d, 1h30m" },
  { id: "created", render: (ctx) => `⏰ Lembrete criado para **${ctx.tempo}**` },
  { id: "fired", render: (ctx) => `⏰ <@${ctx.userId}> Lembre-se de:\n${ctx.mensagem}` },
];
