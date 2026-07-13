"use strict";

module.exports = [
  { id: "no_permission", render: (ctx) =>
    `❌ Você precisa da permissão **${ctx.perm}** para ${ctx.action}.` },
  { id: "no_permission_title", render: (ctx) =>
    `# ${ctx.emoji ?? "❌"} Sem permissão\nVocê precisa da permissão **${ctx.perm}** para ${ctx.action}.` },
  { id: "perm_manage_guild", render: () => "Gerenciar Servidor" },
  { id: "perm_manage_channels", render: () => "Gerenciar Canais" },
  { id: "action_use_command", render: () => "usar este comando" },
  { id: "action_use_subcommand", render: () => "usar este subcomando" },
  { id: "action_install_systems", render: () => "instalar sistemas" },
];
