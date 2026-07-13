"use strict";

module.exports = [
  { id: "header", render: (ctx) => `# ${ctx.eDefault} Rango de Aventurero` },

  { id: "self_text", render: (ctx) =>
    `${ctx.eAnimada} ¡Estás en el **Rango de Aventurero ${ctx.ar}** con \`${ctx.xpAtual} XP\`!\n` +
    `¡Solo faltan \`${ctx.xpRestante} XP\` para el próximo rango!\n\n` +
    `-# ${ctx.eSria} Sigue creciendo. Observo cada paso que das… y espero progreso.` },

  { id: "other_text", render: (ctx) =>
    `${ctx.eFeliz} [${ctx.userName}](${ctx.userUrl}) está en el **Rango de Aventurero ${ctx.ar}** con \`${ctx.xpAtual} XP\`!\n` +
    `¡Solo faltan \`${ctx.xpRestante} XP\` para el próximo rango!\n\n` +
    `-# ${ctx.eSria} Observo a cada aventurero… y espero progreso de todos.` },

  { id: "unknown_adventurer", render: () => "Aventurero Desconocido" },

  { id: "empty_title", render: (ctx) => `${ctx.eEmduvida} ¡Aún no hay aventureros!` },
  { id: "empty_desc", render: (ctx) =>
    `${ctx.eEmburrada} Parece que nadie ha subido de rango todavía...\n\n¡Sé el primero! ${ctx.eAnimada}` },

  { id: "leaderboard_title", render: (ctx) => `${ctx.eFesta} Ranking de Aventureros` },
  { id: "leaderboard_intro", render: (ctx) => `${ctx.eAnimada} *Los mejores aventureros están aquí!*` },
  { id: "footer", render: (ctx) => `Página ${ctx.page} de ${ctx.totalPages} • Ayami Hoshiori` },
  { id: "rank_line", render: (ctx) =>
    `${ctx.prefix} [${ctx.name}](${ctx.userUrl}) • Rango ${ctx.nivel} \`(${ctx.xp} XP)\`` },
];
