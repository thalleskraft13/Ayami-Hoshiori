"use strict";

module.exports = [
  { id: "saved", render: (ctx) =>
    `${ctx.eAnimada} UID salvo com sucesso! Agora todo mundo pode te encontrar no jogo~\n**${ctx.uid}** \`(${ctx.servidor})\` ${ctx.eCorao}` },
  { id: "not_found_title", render: (ctx) => `${ctx.eEmduvida} UID não encontrado...` },
  { id: "not_found_desc", render: (ctx) =>
    `${ctx.eEmburrada} [${ctx.userName}](${ctx.userUrl}) ainda não salvou nenhum UID...\n\nUse \`/uid salvar\` pra registrar o seu!` },
  { id: "found_title", render: (ctx) => `${ctx.eFeliz} UID de ${ctx.userName}` },
  { id: "found_desc", render: (ctx) =>
    `${ctx.eCurtida} O UID de [${ctx.userName}](${ctx.userUrl}) é **${ctx.uid}** \`(${ctx.servidor})\`!\n\nVá lá e adiciona ele no jogo~ ${ctx.eAnimada}` },
];
