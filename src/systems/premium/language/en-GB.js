"use strict";

module.exports = [
  { id: "redeem_title", render: (ctx) => `# ${ctx.eAnimada} Constellation Redemption` },
  { id: "redeem_success", render: (ctx) =>
    `${ctx.eFesta} Key redeemed successfully!\n\nCode: \`${ctx.codigo}\`\n\nWelcome to Constellation~ ${ctx.eCorao}` },
  { id: "redeem_fail", render: (ctx) => `${ctx.eChorando} Oops! ${ctx.motivo}` },

  { id: "buy_title", render: (ctx) =>
    `# ${ctx.eFeliz} Constellation — Ayami Hoshiori\n${ctx.eAnimada} **Ayami's official subscription has arrived!**` },

  { id: "buy_plans", render: (ctx) =>
    `✨ **Pick your plan:**\n\n` +
    `> 🌟 **New Star** — R$ 7.99/month\n` +
    `> 　 1 server · 25 Logic Builder flows · 15 Logic Script files\n` +
    `> 　 +25% daily bonus · Advanced Tickets (up to 10 questions)\n\n` +
    `> 🌙 **Crescent Moon** — R$ 14.99/month\n` +
    `> 　 3 servers · 35 Logic Builder flows · 35 Logic Script files\n` +
    `> 　 +60% daily bonus · +0.5% 5⭐ chance · HTTP and Webhooks unlocked in Logic Script\n` +
    `> 　 Unlimited-question tickets\n\n` +
    `> ✨ **Constellation** — R$ 24.99/month\n` +
    `> 　 Unlimited servers · Unlimited Logic Builder and Logic Script\n` +
    `> 　 +100% daily bonus · +1% 5⭐ chance · Early access and Ayami CANARY\n\n` +
    `${ctx.eCurtida} **Or grab a standalone Code for any plan**\n` +
    `> 🔑 Talk to staff to generate your key` },

  { id: "buy_benefits", render: (ctx) =>
    `${ctx.eCorao} **Exclusive perks:**\n\n` +
    `🏅 Exclusive role on the Official Server\n` +
    `⭐ Better odds when getting 5-Star Characters\n` +
    `💎 Primogem bonus on Daily\n` +
    `⚙️ Advanced settings across systems\n` +
    `　*(Chat Type, Sequential Form, Modal Form,*\n` +
    `　*Temporary Roles, Ticket Setup and much more)*\n` +
    `🔗 Webhook usage in Systems\n` +
    `📌 Pinned Button + Webhook in the Birthday System` },

  { id: "buy_footer", render: (ctx) =>
    `${ctx.ePensando} *Constellation isn't just a plan.*\n*It's your place among the stars.* ${ctx.eSria}` },

  { id: "buy_button", render: () => "✨ Subscribe to Constellation" },

  { id: "panel_no_premium", render: (ctx) =>
    `# ${ctx.eEmduvida} Constellation\n` +
    `${ctx.eEmburrada} You don't have Constellation active yet...\n\n` +
    `Use \`/premium comprar\` to check out the plans\n` +
    `or \`/premium resgatar\` if you've already got a code!\n\n` +
    `${ctx.eCarinho} *Come shine with Ayami~*` },

  { id: "panel_header", render: (ctx) =>
    `# ${ctx.eFesta} Constellation Panel\n` +
    `${ctx.eAnimada} **Subscriber:** <@${ctx.userId}>\n` +
    `✨ **Plan:** ${ctx.planEmoji} ${ctx.planName}\n` +
    `⏳ **Expires in:** \`${ctx.tempo}\`\n\n` +
    `🏠 **Servers with Constellation:** ${ctx.count}/${ctx.limit}` },

  { id: "linked_servers_label", render: (ctx) => `**Linked servers:**\n${ctx.lista}` },
  { id: "server_line", render: (ctx) => `${ctx.eCurtida} **${ctx.name}** \`(${ctx.guildId})\`` },

  { id: "current_server_label", render: (ctx) => `**Current Server**\n${ctx.status}` },
  { id: "current_active", render: (ctx) => `${ctx.eFeliz} Constellation is **active** here!\n⏳ \`${ctx.tempo}\`` },
  { id: "current_inactive", render: (ctx) =>
    `${ctx.eEmburrada} Constellation **not active** on this server.\nUse the button below to activate it!` },

  { id: "btn_activate", render: () => "✨ Activate on this Server" },
  { id: "btn_remove", render: () => "🗑️ Remove from this Server" },
  { id: "btn_view_plans", render: () => "✨ View Constellation Plans" },

  { id: "buy_plans_alt", render: (ctx) =>
    `✨ **Pick your plan:**\n\n` +
    `> 🗓 **Monthly** — R$ 7.99\n` +
    `> 📆 **Quarterly** — R$ 21.99\n` +
    `> 📅 **Half-yearly** — R$ 39.99\n\n` +
    `${ctx.eCurtida} **Or grab a Constellation Code**\n` +
    `> 🔑 Standalone key — R$ 8.50` },

  { id: "panel_header_alt", render: (ctx) =>
    `# ${ctx.eFesta} Constellation Panel\n` +
    `${ctx.eAnimada} **Subscriber:** <@${ctx.userId}>\n` +
    `✨ **Status:** Constellation Active\n` +
    `⏳ **Expires in:** \`${ctx.tempo}\`\n\n` +
    `🏠 **Servers with Constellation:** ${ctx.count}` },
];
