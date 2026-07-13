"use strict";

module.exports = [
  { id: "unavailable", render: (ctx) =>
    `${ctx.emoji} Essa interação expirou ou não está mais disponível... Execute o comando novamente!` },

  { id: "expired", render: (ctx) =>
    `${ctx.emoji} Esse formulário expirou! Execute novamente, por favor~` },

  { id: "unauthorized", render: (ctx) =>
    `${ctx.emoji} Ei! Você não pode usar este componente!` },

  { id: "unauthorized_modal", render: (ctx) =>
    `${ctx.emoji} Ei! Você não pode responder este formulário!` },

  { id: "error_message", render: (ctx) =>
    `${ctx.emoji} Ops, algo deu errado ao processar essa interação...\n\n` +
    `Contexto: **\`${ctx.context}\`**\n` +
    `ID do erro: **\`${ctx.errorId}\`**\n` +
    `Detalhe: \`\`\`\n${ctx.detail}\n\`\`\`` },

  { id: "error_unknown_detail", render: () => "Desconhecido" },
];
