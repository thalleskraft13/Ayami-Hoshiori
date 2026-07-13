"use strict";

module.exports = [
  { id: "saved", render: (ctx) =>
    `${ctx.eAnimada} ¡UID guardado con éxito! Ahora todos pueden encontrarte en el juego~\n**${ctx.uid}** \`(${ctx.servidor})\` ${ctx.eCorao}` },
  { id: "not_found_title", render: (ctx) => `${ctx.eEmduvida} UID no encontrado...` },
  { id: "not_found_desc", render: (ctx) =>
    `${ctx.eEmburrada} [${ctx.userName}](${ctx.userUrl}) todavía no ha guardado ningún UID...\n\n¡Usa \`/uid salvar\` para registrar el tuyo!` },
  { id: "found_title", render: (ctx) => `${ctx.eFeliz} UID de ${ctx.userName}` },
  { id: "found_desc", render: (ctx) =>
    `${ctx.eCurtida} ¡El UID de [${ctx.userName}](${ctx.userUrl}) es **${ctx.uid}** \`(${ctx.servidor})\`!\n\nVe y agrégalo en el juego~ ${ctx.eAnimada}` },
];
