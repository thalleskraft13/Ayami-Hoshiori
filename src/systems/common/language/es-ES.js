"use strict";

module.exports = [
  { id: "no_permission", render: (ctx) =>
    `❌ Necesitas el permiso **${ctx.perm}** para ${ctx.action}.` },
  { id: "no_permission_title", render: (ctx) =>
    `# ${ctx.emoji ?? "❌"} Sin permiso\nNecesitas el permiso **${ctx.perm}** para ${ctx.action}.` },
  { id: "perm_manage_guild", render: () => "Gestionar Servidor" },
  { id: "perm_manage_channels", render: () => "Gestionar Canales" },
  { id: "action_use_command", render: () => "usar este comando" },
  { id: "action_use_subcommand", render: () => "usar este subcomando" },
  { id: "action_install_systems", render: () => "instalar sistemas" },
];
