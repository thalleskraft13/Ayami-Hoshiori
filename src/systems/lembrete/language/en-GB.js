"use strict";

module.exports = [
  { id: "invalid_time", render: () => "❌ Invalid time. Use: 10s, 5m, 1h, 2d, 1h30m" },
  { id: "created", render: (ctx) => `⏰ Reminder set for **${ctx.tempo}**` },
  { id: "fired", render: (ctx) => `⏰ <@${ctx.userId}> Don't forget:\n${ctx.mensagem}` },
];
