"use strict";

module.exports = [
  { id: "invalid_time", render: () => "❌ Tiempo inválido. Usa: 10s, 5m, 1h, 2d, 1h30m" },
  { id: "created", render: (ctx) => `⏰ Recordatorio creado para **${ctx.tempo}**` },
  { id: "fired", render: (ctx) => `⏰ <@${ctx.userId}> Recuerda:\n${ctx.mensagem}` },
];
