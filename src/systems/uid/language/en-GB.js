"use strict";

module.exports = [
  { id: "saved", render: (ctx) =>
    `${ctx.eAnimada} UID saved successfully! Now everyone can find you in-game~\n**${ctx.uid}** \`(${ctx.servidor})\` ${ctx.eCorao}` },
  { id: "not_found_title", render: (ctx) => `${ctx.eEmduvida} UID not found...` },
  { id: "not_found_desc", render: (ctx) =>
    `${ctx.eEmburrada} [${ctx.userName}](${ctx.userUrl}) hasn't saved a UID yet...\n\nUse \`/uid salvar\` to register yours!` },
  { id: "found_title", render: (ctx) => `${ctx.eFeliz} ${ctx.userName}'s UID` },
  { id: "found_desc", render: (ctx) =>
    `${ctx.eCurtida} ${ctx.userName}'s UID is **${ctx.uid}** \`(${ctx.servidor})\`, [click here](${ctx.userUrl}) to check their profile!\n\nGo add them in-game~ ${ctx.eAnimada}` },
];
