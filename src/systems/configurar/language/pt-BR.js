"use strict";

module.exports = [
  { id: "select_placeholder", render: () => "Selecione um sistema para configurar" },

  { id: "opt_tickets_label", render: () => "Sistema de Tickets" },
  { id: "opt_tickets_desc", render: () => "Painéis, categorias, staff e automações" },
  { id: "opt_uid_label", render: () => "Sistema de UID" },
  { id: "opt_uid_desc", render: () => "Compartilhamento automático de UID" },
  { id: "opt_security_label", render: () => "Sistema de segurança" },
  { id: "opt_security_desc", render: () => "Analise permissões, cargos, bots e segurança" },
  { id: "opt_logic_label", render: () => "Logic Builder" },
  { id: "opt_logic_desc", render: () => "Criação de fluxos e automações" },
  { id: "opt_activity_label", render: () => "Análise de Atividade" },
  { id: "opt_activity_desc", render: () => "Estatísticas e insights sobre a atividade do servidor" },

  { id: "header", render: (ctx) =>
    `# ⚙️ Central de Configuração ${ctx.emoji ?? ''}\n` +
    `Bem-vindo ao painel principal de configuração!\n\n` +
    `> Escolha um sistema no menu abaixo para começar.` },

  { id: "body", render: () =>
    `**🎫 Sistema de Tickets**\n` +
    `Configure painéis, categorias, staff, modais e automações.\n\n` +
    `**✨ Compartilhamento de UID**\n` +
    `Configure envio automático de UID em canais específicos.\n` +
    `Suporte a webhook com nome e foto do usuário.\n\n` +
    `**🔍 Sistema de Segurança**\n` +
    `Analise permissões, cargos, bots e segurança do servidor.\n\n` +
    `**⚡ Logic Builder**\n` +
    `Crie automações e fluxos personalizados para seu servidor.` },

  { id: "fallback_guild_name", render: (ctx) => `Servidor ${ctx.guildId}` },
  { id: "dashboard_button", render: () => "🌐 Abrir Dashboard do Servidor" },
];
