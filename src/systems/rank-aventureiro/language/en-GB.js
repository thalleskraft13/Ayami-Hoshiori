"use strict";

module.exports = [
  { id: "header", render: (ctx) => `# ${ctx.eDefault} Adventurer Rank` },

  { id: "self_text", render: (ctx) =>
    `${ctx.eAnimada} You're at **Adventurer Rank ${ctx.ar}** with \`${ctx.xpAtual} XP\`!\n` +
    `Only \`${ctx.xpRestante} XP\` left until the next rank!\n\n` +
    `-# ${ctx.eSria} Keep growing. I watch every step you take… and I expect progress.` },

  { id: "other_text", render: (ctx) =>
    `${ctx.eFeliz} [${ctx.userName}](${ctx.userUrl}) is at **Adventurer Rank ${ctx.ar}** with \`${ctx.xpAtual} XP\`!\n` +
    `Only \`${ctx.xpRestante} XP\` left until the next rank!\n\n` +
    `-# ${ctx.eSria} I watch every adventurer… and I expect progress from all of you.` },

  { id: "unknown_adventurer", render: () => "Unknown Adventurer" },

  { id: "empty_title", render: (ctx) => `${ctx.eEmduvida} No adventurers yet!` },
  { id: "empty_desc", render: (ctx) =>
    `${ctx.eEmburrada} Looks like nobody's ranked up yet...\n\nGo on, be the first! ${ctx.eAnimada}` },

  { id: "leaderboard_title", render: (ctx) => `${ctx.eFesta} Adventurer Leaderboard` },
  { id: "leaderboard_intro", render: (ctx) => `${ctx.eAnimada} *The greatest adventurers are here!*` },
  { id: "footer", render: (ctx) => `Page ${ctx.page} of ${ctx.totalPages} • Ayami Hoshiori` },
  { id: "rank_line", render: (ctx) =>
    `${ctx.prefix} [${ctx.name}](${ctx.userUrl}) • Rank ${ctx.nivel} \`(${ctx.xp} XP)\`` },
];
