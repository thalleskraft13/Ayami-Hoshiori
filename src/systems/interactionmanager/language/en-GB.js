"use strict";

module.exports = [
  { id: "unavailable", render: (ctx) =>
    `${ctx.emoji} This interaction has expired or is no longer available... Run the command again!` },

  { id: "expired", render: (ctx) =>
    `${ctx.emoji} This form has expired! Please run it again~` },

  { id: "unauthorized", render: (ctx) =>
    `${ctx.emoji} Hey! You can't use this component!` },

  { id: "unauthorized_modal", render: (ctx) =>
    `${ctx.emoji} Hey! You can't submit this form!` },

  { id: "error_message", render: (ctx) =>
    `${ctx.emoji} Oops, something went wrong whilst processing this interaction...\n\n` +
    `Context: **\`${ctx.context}\`**\n` +
    `Error ID: **\`${ctx.errorId}\`**\n` +
    `Detail: \`\`\`\n${ctx.detail}\n\`\`\`` },

  { id: "error_unknown_detail", render: () => "Unknown" },
];
