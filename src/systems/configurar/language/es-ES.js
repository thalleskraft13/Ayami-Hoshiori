"use strict";

module.exports = [
  { id: "select_placeholder", render: () => "Selecciona un sistema para configurar" },

  { id: "opt_tickets_label", render: () => "Sistema de Tickets" },
  { id: "opt_tickets_desc", render: () => "Paneles, categorías, staff y automatizaciones" },
  { id: "opt_uid_label", render: () => "Sistema de UID" },
  { id: "opt_uid_desc", render: () => "Compartición automática de UID" },
  { id: "opt_security_label", render: () => "Sistema de seguridad" },
  { id: "opt_security_desc", render: () => "Revisa permisos, roles, bots y seguridad" },
  { id: "opt_logic_label", render: () => "Logic Builder" },
  { id: "opt_logic_desc", render: () => "Creación de flujos y automatizaciones" },
  { id: "opt_activity_label", render: () => "Análisis de Actividad" },
  { id: "opt_activity_desc", render: () => "Estadísticas e información sobre la actividad del servidor" },

  { id: "header", render: (ctx) =>
    `# ⚙️ Centro de Configuración ${ctx.emoji ?? ''}\n` +
    `¡Bienvenido al panel principal de configuración!\n\n` +
    `> Elige un sistema en el menú de abajo para empezar.` },

  { id: "body", render: () =>
    `**🎫 Sistema de Tickets**\n` +
    `Configura paneles, categorías, staff, modales y automatizaciones.\n\n` +
    `**✨ Compartición de UID**\n` +
    `Configura el envío automático de UID en canales específicos.\n` +
    `Soporte de webhook con nombre y foto del usuario.\n\n` +
    `**🔍 Sistema de Seguridad**\n` +
    `Revisa permisos, roles, bots y seguridad del servidor.\n\n` +
    `**⚡ Logic Builder**\n` +
    `Crea automatizaciones y flujos personalizados para tu servidor.` },

  { id: "fallback_guild_name", render: (ctx) => `Servidor ${ctx.guildId}` },
];
