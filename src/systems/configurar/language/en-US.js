"use strict";

module.exports = [
  { id: "select_placeholder", render: () => "Select a system to configure" },

  { id: "opt_tickets_label", render: () => "Ticket System" },
  { id: "opt_tickets_desc", render: () => "Panels, categories, staff and automations" },
  { id: "opt_uid_label", render: () => "UID System" },
  { id: "opt_uid_desc", render: () => "Automatic UID sharing" },
  { id: "opt_security_label", render: () => "Security System" },
  { id: "opt_security_desc", render: () => "Review permissions, roles, bots and security" },
  { id: "opt_logic_label", render: () => "Logic Builder" },
  { id: "opt_logic_desc", render: () => "Create flows and automations" },
  { id: "opt_activity_label", render: () => "Activity Analytics" },
  { id: "opt_activity_desc", render: () => "Server activity statistics and insights" },

  { id: "header", render: (ctx) =>
    `# ⚙️ Configuration Hub ${ctx.emoji ?? ''}\n` +
    `Welcome to the main configuration panel!\n\n` +
    `> Pick a system from the menu below to get started.` },

  { id: "body", render: () =>
    `**🎫 Ticket System**\n` +
    `Configure panels, categories, staff, modals and automations.\n\n` +
    `**✨ UID Sharing**\n` +
    `Set up automatic UID posting in specific channels.\n` +
    `Webhook support with the user's name and avatar.\n\n` +
    `**🔍 Security System**\n` +
    `Review the server's permissions, roles, bots and security.\n\n` +
    `**⚡ Logic Builder**\n` +
    `Create custom automations and flows for your server.` },

  { id: "fallback_guild_name", render: (ctx) => `Server ${ctx.guildId}` },
  { id: "dashboard_button", render: () => "🌐 Open Server Dashboard" },
];
