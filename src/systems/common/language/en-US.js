"use strict";

module.exports = [
  { id: "no_permission", render: (ctx) =>
    `❌ You need the **${ctx.perm}** permission to ${ctx.action}.` },
  { id: "no_permission_title", render: (ctx) =>
    `# ${ctx.emoji ?? "❌"} No permission\nYou need the **${ctx.perm}** permission to ${ctx.action}.` },
  { id: "perm_manage_guild", render: () => "Manage Server" },
  { id: "perm_manage_channels", render: () => "Manage Channels" },
  { id: "action_use_command", render: () => "use this command" },
  { id: "action_use_subcommand", render: () => "use this subcommand" },
  { id: "action_install_systems", render: () => "install systems" },
];
