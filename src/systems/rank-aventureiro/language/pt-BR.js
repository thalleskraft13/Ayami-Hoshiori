"use strict";

module.exports = [
  { id: "header", render: (ctx) => `# ${ctx.eDefault} Rank de Aventureiro` },

  { id: "self_text", render: (ctx) =>
    `${ctx.eAnimada} Você está no **Rank de Aventureiro ${ctx.ar}** com \`${ctx.xpAtual} XP\`!\n` +
    `Faltam apenas \`${ctx.xpRestante} XP\` pro próximo rank!\n\n` +
    `-# ${ctx.eSria} Continue crescendo. Eu observo cada passo seu… e espero progresso.` },

  { id: "other_text", render: (ctx) =>
    `${ctx.eFeliz} [${ctx.userName}](${ctx.userUrl}) está no **Rank de Aventureiro ${ctx.ar}** com \`${ctx.xpAtual} XP\`!\n` +
    `Faltam apenas \`${ctx.xpRestante} XP\` pro próximo rank!\n\n` +
    `-# ${ctx.eSria} Eu observo cada aventureiro… e espero progresso de todos.` },

  { id: "unknown_adventurer", render: () => "Aventureiro Desconhecido" },

  { id: "empty_title", render: (ctx) => `${ctx.eEmduvida} Nenhum aventureiro ainda!` },
  { id: "empty_desc", render: (ctx) =>
    `${ctx.eEmburrada} Parece que ninguém subiu de rank ainda...\n\nVá lá e seja o primeiro! ${ctx.eAnimada}` },

  { id: "leaderboard_title", render: (ctx) => `${ctx.eFesta} Ranking de Aventureiros` },
  { id: "leaderboard_intro", render: (ctx) => `${ctx.eAnimada} *Os maiores aventureiros estão aqui!*` },
  { id: "footer", render: (ctx) => `Página ${ctx.page} de ${ctx.totalPages} • Ayami Hoshiori` },
  { id: "rank_line", render: (ctx) =>
    `${ctx.prefix} [${ctx.name}](${ctx.userUrl}) • Rank ${ctx.nivel} \`(${ctx.xp} XP)\`` },
];
