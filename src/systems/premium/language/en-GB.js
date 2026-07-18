"use strict";

module.exports = [
  { id: "redeem_title", render: (ctx) => `# ${ctx.eAnimada} Constellation Redemption` },
  { id: "redeem_success", render: (ctx) =>
    `${ctx.eFesta} Key redeemed successfully!\n\nCode: \`${ctx.codigo}\`\n\nWelcome to Constellation~ ${ctx.eCorao}` },
  { id: "redeem_fail", render: (ctx) => `${ctx.eChorando} Oops! ${ctx.motivo}` },

  { id: "buy_title", render: (ctx) =>
    `# ${ctx.eFeliz} Constellation — Ayami Hoshiori\n${ctx.eAnimada} **Ayami's official subscription has arrived!**` },

  { id: "buy_redirect_desc", render: (ctx) =>
    `✨ Check out every plan, perk and the full comparison on our website!\n\n` +
    `${ctx.eCurtida} You can also grab your Constellation subscription there, quick and easy~` },

  { id: "buy_plans", render: (ctx) =>
    `✨ **Pick your plan:**\n\n` +
    `> 🌟 **New Star** — R$ 7.99/month\n` +
    `> 　 1 server with premium · 25 Logic Builder flows\n` +
    `> 　 15 Logic Script files (up to 40 functions/file)\n` +
    `> 　 Advanced tickets (up to 10 questions, 2 advanced types, Modal)\n` +
    `> 　 Advanced settings and systems unlocked\n` +
    `> 　 +25% Primogems on /daily · 5⭐ chance rises to 20%\n\n` +
    `> 🌙 **Crescent Moon** — R$ 14.99/month\n` +
    `> 　 3 servers with premium · 35 Logic Builder flows\n` +
    `> 　 35 Logic Script files (unlimited functions)\n` +
    `> 　 HTTP and Webhooks unlocked in Logic Script · \`runFlow()\` by ID\n` +
    `> 　 Unlimited questions and advanced types on tickets\n` +
    `> 　 Advanced giveaway requirements (external server, level, XP, call time)\n` +
    `> 　 +60% Primogems on /daily · 5⭐ chance rises to 27.5%\n` +
    `> 　 Summon and bonus reward perks\n\n` +
    `> ✨ **Constellation** — R$ 24.99/month\n` +
    `> 　 Unlimited servers, Logic Builder and Logic Script\n` +
    `> 　 Everything from Crescent Moon, with no caps\n` +
    `> 　 Custom Ayami Profile on your server (bot's own avatar)\n` +
    `> 　 +100% Primogems on /daily · 5⭐ chance rises to 35%\n` +
    `> 　 Early Access and Ayami CANARY\n\n` +
    `${ctx.eCurtida} **Or grab a standalone Code for any plan**\n` +
    `> 🔑 Purchases and key generation happen on the **Official Server**` },

  { id: "buy_comparison", render: () =>
    `📊 **Quick plan comparison:**\n` +
    "```\n" +
    "                      New Star   Crescent   Constellation\n" +
    "Servers w/ premium       1          3            ∞\n" +
    "Logic Builder flows      25         35           ∞\n" +
    "Logic Script files       15         35           ∞\n" +
    "HTTP / Webhooks (LS)     ✖          ✔            ✔\n" +
    "runFlow() by ID          ✖          ✔            ✔\n" +
    "Questions per Ticket     10         ∞            ∞\n" +
    "Ticket Threads           ✔          ✔            ✔\n" +
    "Advanced giveaways       ✖          ✔            ✔\n" +
    "/daily bonus            +25%       +60%         +100%\n" +
    "Total 5⭐ chance          20%       27.5%         35%\n" +
    "Ayami Profile            ✖          ✖            ✔\n" +
    "Early Access / CANARY    ✖          ✖            ✔\n" +
    "```\n" +
    "_Base 5⭐ chance without premium: 10%._" },

  { id: "buy_benefits", render: (ctx) =>
    `${ctx.eCorao} **Exclusive perks:**\n\n` +
    `🏅 Exclusive role on the Official Server\n` +
    `⭐ Better odds when getting 5-Star Characters\n` +
    `💎 Primogem bonus on Daily\n` +
    `⚙️ Advanced settings and systems\n` +
    `　*(Chat Type, Sequential Form, Modal Form,*\n` +
    `　*Temporary Roles, Ticket Setup, Threads and much more)*\n` +
    `🔗 Webhook usage in Systems (Birthday, notifications and more)\n` +
    `📌 Pinned Button in the Birthday System\n` +
    `🌐 HTTP and custom Webhooks in Logic Script _(from 🌙 Crescent Moon)_\n` +
    `👤 Custom Ayami Profile on your server _(✨ Constellation exclusive)_` },

  { id: "buy_footer", render: (ctx) =>
    `${ctx.ePensando} *Constellation isn't just a plan.*\n*It's your place among the stars.* ${ctx.eSria}\n\n` +
    `🛒 *Subscriptions and standalone keys are sold exclusively on Ayami's **Official Server**.*` },

  { id: "buy_button", render: () => "🌐 View Plans on the Website" },

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
