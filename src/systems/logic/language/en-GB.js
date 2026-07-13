"use strict";

module.exports = [
  { id: "script_load_error", render: () =>
    `# 📜 Logic Script\n⚠️ Couldn't load the info right now. Please try again shortly.` },

  { id: "never", render: () => "never" },
  { id: "just_now", render: () => "just now" },
  { id: "min_ago", render: (ctx) => `${ctx.n} min ago` },
  { id: "hours_ago", render: (ctx) => `${ctx.n}h ago` },
  { id: "days_ago", render: (ctx) => `${ctx.n}d ago` },

  { id: "panel_header", render: (ctx) =>
    `# 📜 Logic Script — Panel\n` +
    `Status: ${ctx.statusIcon} ${ctx.statusText} · Prefix: \`${ctx.prefix}\`\n` +
    `Current plan: ${ctx.planEmoji} **${ctx.planName}**` },
  { id: "status_active", render: () => "Active" },
  { id: "status_disabled", render: () => "Disabled" },

  { id: "files_line", render: (ctx) =>
    `**📁 Files:** ${ctx.fileCount}/${ctx.fileLimit}\n` +
    `**🔧 Functions (total):** ${ctx.functionCount} _(up to ${ctx.perFileFnLimit} per file)_` },

  { id: "features_label", render: (ctx) => `**✨ Plan features:**\n${ctx.featureLines}` },
  { id: "feature_http", render: () => "HTTP requests" },
  { id: "feature_webhooks", render: () => "Webhooks" },
  { id: "feature_runflow", render: () => "Run Logic Builder flows (runFlow)" },

  { id: "runs_line", render: (ctx) =>
    `**📊 Runs (last 7 days):** ${ctx.totalRuns}\n` +
    `**🕐 Last run:** ${ctx.lastRunText}` },
  { id: "no_run_yet", render: () => "none yet" },

  { id: "warnings_label", render: (ctx) => `**⚠️ Warnings (files with syntax errors):**\n${ctx.errorsText}` },
  { id: "no_file_errors", render: () => "_No files with errors right now._" },
  { id: "syntax_error_fallback", render: () => "syntax error" },

  { id: "recent_errors_label", render: (ctx) => `**🐛 Recent run errors:**\n${ctx.recentErrorsText}` },
  { id: "no_recent_errors", render: () => "_No recent run errors._" },
  { id: "error_fallback", render: () => "error" },

  { id: "btn_dashboard", render: () => "Dashboard" },
  { id: "btn_manage", render: () => "Manage" },
];
