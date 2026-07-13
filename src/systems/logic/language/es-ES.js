"use strict";

module.exports = [
  { id: "script_load_error", render: () =>
    `# 📜 Logic Script\n⚠️ No fue posible cargar la información ahora. ¡Inténtalo de nuevo en unos instantes!` },

  { id: "never", render: () => "nunca" },
  { id: "just_now", render: () => "justo ahora" },
  { id: "min_ago", render: (ctx) => `hace ${ctx.n} min` },
  { id: "hours_ago", render: (ctx) => `hace ${ctx.n}h` },
  { id: "days_ago", render: (ctx) => `hace ${ctx.n}d` },

  { id: "panel_header", render: (ctx) =>
    `# 📜 Logic Script — Panel\n` +
    `Estado: ${ctx.statusIcon} ${ctx.statusText} · Prefijo: \`${ctx.prefix}\`\n` +
    `Plan actual: ${ctx.planEmoji} **${ctx.planName}**` },
  { id: "status_active", render: () => "Activo" },
  { id: "status_disabled", render: () => "Desactivado" },

  { id: "files_line", render: (ctx) =>
    `**📁 Archivos:** ${ctx.fileCount}/${ctx.fileLimit}\n` +
    `**🔧 Funciones (total):** ${ctx.functionCount} _(hasta ${ctx.perFileFnLimit} por archivo)_` },

  { id: "features_label", render: (ctx) => `**✨ Funciones del plan:**\n${ctx.featureLines}` },
  { id: "feature_http", render: () => "Solicitudes HTTP" },
  { id: "feature_webhooks", render: () => "Webhooks" },
  { id: "feature_runflow", render: () => "Ejecutar Flujo del Logic Builder (runFlow)" },

  { id: "runs_line", render: (ctx) =>
    `**📊 Ejecuciones (últimos 7 días):** ${ctx.totalRuns}\n` +
    `**🕐 Última ejecución:** ${ctx.lastRunText}` },
  { id: "no_run_yet", render: () => "ninguna todavía" },

  { id: "warnings_label", render: (ctx) => `**⚠️ Avisos (archivos con error de sintaxis):**\n${ctx.errorsText}` },
  { id: "no_file_errors", render: () => "_Ningún archivo con error por ahora._" },
  { id: "syntax_error_fallback", render: () => "error de sintaxis" },

  { id: "recent_errors_label", render: (ctx) => `**🐛 Errores recientes de ejecución:**\n${ctx.recentErrorsText}` },
  { id: "no_recent_errors", render: () => "_Ningún error de ejecución reciente._" },
  { id: "error_fallback", render: () => "error" },

  { id: "btn_dashboard", render: () => "Dashboard" },
  { id: "btn_manage", render: () => "Gestionar" },
];
