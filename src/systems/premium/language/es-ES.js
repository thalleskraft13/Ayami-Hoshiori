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
    `> 　 1 servidor con premium · 25 flujos en Logic Builder\n` +
    `> 　 15 archivos en Logic Script (hasta 40 funciones/archivo)\n` +
    `> 　 Tickets avanzados (hasta 10 preguntas, 2 tipos avanzados, Modal)\n` +
    `> 　 Configuraciones y sistemas avanzados desbloqueados\n` +
    `> 　 +25% de Primogemas en el /daily · probabilidad de 5⭐ sube a 20%\n\n` +
    `> 🌙 **Luna Creciente** — R$ 14,99/mes\n` +
    `> 　 3 servidores con premium · 35 flujos en Logic Builder\n` +
    `> 　 35 archivos en Logic Script (funciones ilimitadas)\n` +
    `> 　 HTTP y Webhooks desbloqueados en Logic Script · \`runFlow()\` por ID\n` +
    `> 　 Preguntas y tipos avanzados ilimitados en tickets\n` +
    `> 　 Requisitos avanzados de sorteo (servidor externo, nivel, XP, llamada)\n` +
    `> 　 +60% de Primogemas en el /daily · probabilidad de 5⭐ sube a 27,5%\n` +
    `> 　 Bonos de invocación y recompensas extra\n\n` +
    `> ✨ **Constellation** — R$ 24,99/mes\n` +
    `> 　 Servidores, Logic Builder y Logic Script ilimitados\n` +
    `> 　 Todo lo de Luna Creciente, sin límites\n` +
    `> 　 Perfil Personalizado de Ayami en el servidor (avatar propio del bot)\n` +
    `> 　 +100% de Primogemas en el /daily · probabilidad de 5⭐ sube a 35%\n` +
    `> 　 Acceso anticipado y a Ayami CANARY\n\n` +
    `${ctx.eCurtida} **O consigue un Código individual de cualquier plan**\n` +
    `> 🔑 La compra y la generación de la key se hacen en el **Servidor Oficial**` },

  { id: "buy_comparison", render: () =>
    `📊 **Comparativa rápida entre planes:**\n` +
    "```\n" +
    "                     Nueva Est. Luna Crec. Constellation\n" +
    "Servidores premium       1          3            ∞\n" +
    "Flujos Logic Builder     25         35           ∞\n" +
    "Archivos Logic Script    15         35           ∞\n" +
    "HTTP / Webhooks (LS)     ✖          ✔            ✔\n" +
    "runFlow() por ID         ✖          ✔            ✔\n" +
    "Preguntas por Ticket     10         ∞            ∞\n" +
    "Threads en Ticket        ✔          ✔            ✔\n" +
    "Sorteo avanzado          ✖          ✔            ✔\n" +
    "Bono /daily             +25%       +60%         +100%\n" +
    "Probabilidad total 5⭐    20%       27,5%         35%\n" +
    "Perfil de Ayami          ✖          ✖            ✔\n" +
    "Acceso anticipado/CANARY ✖          ✖            ✔\n" +
    "```\n" +
    "_Probabilidad base de 5⭐ sin premium: 10%._" },

  { id: "buy_benefits", render: (ctx) =>
    `${ctx.eCorao} **Beneficios exclusivos:**\n\n` +
    `🏅 Rol exclusivo en el Servidor Oficial\n` +
    `⭐ Más probabilidades al obtener Personajes de 5 Estrellas\n` +
    `💎 Bono de Primogemas en el Daily\n` +
    `⚙️ Configuraciones y sistemas avanzados\n` +
    `　*(Tipo de Chat, Formulario Secuencial, Formulario por Modal,*\n` +
    `　*Roles Temporales, Ticket Setup, Threads y mucho más)*\n` +
    `🔗 Uso de Webhook en Sistemas (Cumpleaños, notificaciones y más)\n` +
    `📌 Botón Fijo en el Sistema de Cumpleaños\n` +
    `🌐 HTTP y Webhooks personalizados en Logic Script _(desde 🌙 Luna Creciente)_\n` +
    `👤 Perfil Personalizado de Ayami en el servidor _(exclusivo ✨ Constellation)_` },

  { id: "buy_footer", render: (ctx) =>
    `${ctx.ePensando} *Constellation no es solo un plan.*\n*Es tu lugar entre las estrellas.* ${ctx.eSria}\n\n` +
    `🛒 *Las suscripciones y keys individuales se venden exclusivamente en el **Servidor Oficial** de Ayami.*` },

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
