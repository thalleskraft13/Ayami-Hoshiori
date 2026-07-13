"use strict";

module.exports = [
  { id: "script_load_error", render: () =>
    `# 📜 Logic Script\n⚠️ Não foi possível carregar as informações agora. Tente novamente em instantes.` },

  { id: "never", render: () => "nunca" },
  { id: "just_now", render: () => "agora mesmo" },
  { id: "min_ago", render: (ctx) => `há ${ctx.n} min` },
  { id: "hours_ago", render: (ctx) => `há ${ctx.n}h` },
  { id: "days_ago", render: (ctx) => `há ${ctx.n}d` },

  { id: "panel_header", render: (ctx) =>
    `# 📜 Logic Script — Painel\n` +
    `Status: ${ctx.statusIcon} ${ctx.statusText} · Prefixo: \`${ctx.prefix}\`\n` +
    `Plano atual: ${ctx.planEmoji} **${ctx.planName}**` },
  { id: "status_active", render: () => "Ativo" },
  { id: "status_disabled", render: () => "Desativado" },

  { id: "files_line", render: (ctx) =>
    `**📁 Arquivos:** ${ctx.fileCount}/${ctx.fileLimit}\n` +
    `**🔧 Funções (total):** ${ctx.functionCount} _(até ${ctx.perFileFnLimit} por arquivo)_` },

  { id: "features_label", render: (ctx) => `**✨ Recursos do plano:**\n${ctx.featureLines}` },
  { id: "feature_http", render: () => "Requisições HTTP" },
  { id: "feature_webhooks", render: () => "Webhooks" },
  { id: "feature_runflow", render: () => "Executar Fluxo do Logic Builder (runFlow)" },

  { id: "runs_line", render: (ctx) =>
    `**📊 Execuções (últimos 7 dias):** ${ctx.totalRuns}\n` +
    `**🕐 Última execução:** ${ctx.lastRunText}` },
  { id: "no_run_yet", render: () => "nenhuma ainda" },

  { id: "warnings_label", render: (ctx) => `**⚠️ Avisos (arquivos com erro de sintaxe):**\n${ctx.errorsText}` },
  { id: "no_file_errors", render: () => "_Nenhum arquivo com erro no momento._" },
  { id: "syntax_error_fallback", render: () => "erro de sintaxe" },

  { id: "recent_errors_label", render: (ctx) => `**🐛 Erros recentes de execução:**\n${ctx.recentErrorsText}` },
  { id: "no_recent_errors", render: () => "_Nenhum erro de execução recente._" },
  { id: "error_fallback", render: () => "erro" },

  { id: "btn_dashboard", render: () => "Dashboard" },
  { id: "btn_manage", render: () => "Gerenciar" },
];
