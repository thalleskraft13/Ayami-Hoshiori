"use strict";

module.exports = [
  { id: "redeem_title", render: (ctx) => `# ${ctx.eAnimada} Canje de Constellation` },
  { id: "redeem_success", render: (ctx) =>
    `${ctx.eFesta} ¡Key canjeada con éxito!\n\nCódigo: \`${ctx.codigo}\`\n\nBienvenida a Constellation~ ${ctx.eCorao}` },
  { id: "redeem_fail", render: (ctx) => `${ctx.eChorando} ¡Ups! ${ctx.motivo}` },

  { id: "buy_title", render: (ctx) =>
    `# ${ctx.eFeliz} Constellation — Ayami Hoshiori\n${ctx.eAnimada} **¡Llegó la suscripción oficial de Ayami!**` },

  { id: "buy_plans", render: (ctx) =>
    `✨ **Elige tu plan:**\n\n` +
    `> 🌟 **Nueva Estrella** — R$ 7,99/mes\n` +
    `> 　 1 servidor · 25 flujos en Logic Builder · 15 archivos en Logic Script\n` +
    `> 　 +25% en el daily · Tickets Avanzados (hasta 10 preguntas)\n\n` +
    `> 🌙 **Luna Creciente** — R$ 14,99/mes\n` +
    `> 　 3 servidores · 35 flujos en Logic Builder · 35 archivos en Logic Script\n` +
    `> 　 +60% en el daily · +0.5% de probabilidad 5⭐ · HTTP y Webhooks desbloqueados en Logic Script\n` +
    `> 　 Tickets con preguntas ilimitadas\n\n` +
    `> ✨ **Constellation** — R$ 24,99/mes\n` +
    `> 　 Servidores ilimitados · Logic Builder y Logic Script ilimitados\n` +
    `> 　 +100% en el daily · +1% de probabilidad 5⭐ · Acceso anticipado y a Ayami CANARY\n\n` +
    `${ctx.eCurtida} **O consigue un Código individual de cualquier plan**\n` +
    `> 🔑 Habla con el staff para generar tu key` },

  { id: "buy_benefits", render: (ctx) =>
    `${ctx.eCorao} **Beneficios exclusivos:**\n\n` +
    `🏅 Rol exclusivo en el Servidor Oficial\n` +
    `⭐ Más probabilidades al obtener Personajes de 5 Estrellas\n` +
    `💎 Bono de Primogemas en el Daily\n` +
    `⚙️ Configuraciones avanzadas en los sistemas\n` +
    `　*(Tipo de Chat, Formulario Secuencial, Formulario por Modal,*\n` +
    `　*Roles Temporales, Ticket Setup y mucho más)*\n` +
    `🔗 Uso de Webhook en Sistemas\n` +
    `📌 Botón Fijo + Webhook en el Sistema de Cumpleaños` },

  { id: "buy_footer", render: (ctx) =>
    `${ctx.ePensando} *Constellation no es solo un plan.*\n*Es tu lugar entre las estrellas.* ${ctx.eSria}` },

  { id: "buy_button", render: () => "✨ Suscribirse a Constellation" },

  { id: "panel_no_premium", render: (ctx) =>
    `# ${ctx.eEmduvida} Constellation\n` +
    `${ctx.eEmburrada} Todavía no tienes Constellation activa...\n\n` +
    `Usa \`/premium comprar\` para conocer los planes\n` +
    `o \`/premium resgatar\` si ya tienes un código!\n\n` +
    `${ctx.eCarinho} *Ven a brillar con Ayami~*` },

  { id: "panel_header", render: (ctx) =>
    `# ${ctx.eFesta} Panel Constellation\n` +
    `${ctx.eAnimada} **Suscriptor:** <@${ctx.userId}>\n` +
    `✨ **Plan:** ${ctx.planEmoji} ${ctx.planName}\n` +
    `⏳ **Expira en:** \`${ctx.tempo}\`\n\n` +
    `🏠 **Servidores con Constellation:** ${ctx.count}/${ctx.limit}` },

  { id: "linked_servers_label", render: (ctx) => `**Servidores vinculados:**\n${ctx.lista}` },
  { id: "server_line", render: (ctx) => `${ctx.eCurtida} **${ctx.name}** \`(${ctx.guildId})\`` },

  { id: "current_server_label", render: (ctx) => `**Servidor Actual**\n${ctx.status}` },
  { id: "current_active", render: (ctx) => `${ctx.eFeliz} ¡Constellation **activa** aquí!\n⏳ \`${ctx.tempo}\`` },
  { id: "current_inactive", render: (ctx) =>
    `${ctx.eEmburrada} Constellation **no activa** en este servidor.\n¡Usa el botón de abajo para activarla!` },

  { id: "btn_activate", render: () => "✨ Activar en este Servidor" },
  { id: "btn_remove", render: () => "🗑️ Quitar de este Servidor" },
  { id: "btn_view_plans", render: () => "✨ Ver Planes Constellation" },

  { id: "buy_plans_alt", render: (ctx) =>
    `✨ **Elige tu plan:**\n\n` +
    `> 🗓 **Mensual** — R$ 7,99\n` +
    `> 📆 **Trimestral** — R$ 21,99\n` +
    `> 📅 **Semestral** — R$ 39,99\n\n` +
    `${ctx.eCurtida} **O consigue un Código Constellation**\n` +
    `> 🔑 Key individual — R$ 8,50` },

  { id: "panel_header_alt", render: (ctx) =>
    `# ${ctx.eFesta} Panel Constellation\n` +
    `${ctx.eAnimada} **Suscriptor:** <@${ctx.userId}>\n` +
    `✨ **Estado:** Constellation Activa\n` +
    `⏳ **Expira en:** \`${ctx.tempo}\`\n\n` +
    `🏠 **Servidores con Constellation:** ${ctx.count}` },
];
