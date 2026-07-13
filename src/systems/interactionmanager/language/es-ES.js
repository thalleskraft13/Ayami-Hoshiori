"use strict";

module.exports = [
  { id: "unavailable", render: (ctx) =>
    `${ctx.emoji} Esta interacción expiró o ya no está disponible... ¡Ejecuta el comando de nuevo!` },

  { id: "expired", render: (ctx) =>
    `${ctx.emoji} ¡Este formulario expiró! Ejecútalo de nuevo, por favor~` },

  { id: "unauthorized", render: (ctx) =>
    `${ctx.emoji} ¡Oye! ¡No puedes usar este componente!` },

  { id: "unauthorized_modal", render: (ctx) =>
    `${ctx.emoji} ¡Oye! ¡No puedes responder este formulario!` },

  { id: "error_message", render: (ctx) =>
    `${ctx.emoji} Ups, algo salió mal al procesar esta interacción...\n\n` +
    `Contexto: **\`${ctx.context}\`**\n` +
    `ID del error: **\`${ctx.errorId}\`**\n` +
    `Detalle: \`\`\`\n${ctx.detail}\n\`\`\`` },

  { id: "error_unknown_detail", render: () => "Desconocido" },
];
