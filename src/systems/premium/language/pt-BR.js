"use strict";

module.exports = [
  { id: "redeem_title", render: (ctx) => `# ${ctx.eAnimada} Resgate de Constellation` },
  { id: "redeem_success", render: (ctx) =>
    `${ctx.eFesta} Key resgatada com sucesso!\n\nCódigo: \`${ctx.codigo}\`\n\nBem-vinda à Constellation~ ${ctx.eCorao}` },
  { id: "redeem_fail", render: (ctx) => `${ctx.eChorando} Ops! ${ctx.motivo}` },

  { id: "buy_title", render: (ctx) =>
    `# ${ctx.eFeliz} Constellation — Ayami Hoshiori\n${ctx.eAnimada} **A assinatura oficial da Ayami chegou!**` },

  { id: "buy_plans", render: (ctx) =>
    `✨ **Escolha seu plano:**\n\n` +
    `> 🌟 **Nova Estrela** — R$ 7,99/mês\n` +
    `> 　 1 servidor · 25 fluxos no Logic Builder · 15 arquivos no Logic Script\n` +
    `> 　 +25% no daily · Tickets Avançados (até 10 perguntas)\n\n` +
    `> 🌙 **Lua Crescente** — R$ 14,99/mês\n` +
    `> 　 3 servidores · 35 fluxos no Logic Builder · 35 arquivos no Logic Script\n` +
    `> 　 +60% no daily · +0.5% chance 5⭐ · HTTP e Webhooks liberados no Logic Script\n` +
    `> 　 Tickets com perguntas ilimitadas\n\n` +
    `> ✨ **Constellation** — R$ 24,99/mês\n` +
    `> 　 Servidores ilimitados · Logic Builder e Logic Script ilimitados\n` +
    `> 　 +100% no daily · +1% chance 5⭐ · Acesso antecipado e à Ayami CANARY\n\n` +
    `${ctx.eCurtida} **Ou adquira um Código avulso de qualquer plano**\n` +
    `> 🔑 Fale com a staff pra gerar sua key` },

  { id: "buy_benefits", render: (ctx) =>
    `${ctx.eCorao} **Benefícios exclusivos:**\n\n` +
    `🏅 Cargo exclusivo no Servidor Oficial\n` +
    `⭐ Mais chances ao obter Personagens 5 Estrelas\n` +
    `💎 Bônus de Primogemas no Daily\n` +
    `⚙️ Configurações avançadas nos sistemas\n` +
    `　*(Tipo de Chat, Form Sequencial, Form por Modal,*\n` +
    `　*Cargos Temporários, Ticket Setup e muito mais)*\n` +
    `🔗 Uso de Webhook em Sistemas\n` +
    `📌 Botão Fixo + Webhook no Sistema de Aniversário` },

  { id: "buy_footer", render: (ctx) =>
    `${ctx.ePensando} *Constellation não é só um plano.*\n*É o seu lugar entre as estrelas.* ${ctx.eSria}` },

  { id: "buy_button", render: () => "✨ Assinar Constellation" },

  { id: "panel_no_premium", render: (ctx) =>
    `# ${ctx.eEmduvida} Constellation\n` +
    `${ctx.eEmburrada} Você ainda não possui a Constellation ativa...\n\n` +
    `Use \`/premium comprar\` para conhecer os planos\n` +
    `ou \`/premium resgatar\` se já tiver um código!\n\n` +
    `${ctx.eCarinho} *Venha brilhar com a Ayami~*` },

  { id: "panel_header", render: (ctx) =>
    `# ${ctx.eFesta} Painel Constellation\n` +
    `${ctx.eAnimada} **Assinante:** <@${ctx.userId}>\n` +
    `✨ **Plano:** ${ctx.planEmoji} ${ctx.planName}\n` +
    `⏳ **Expira em:** \`${ctx.tempo}\`\n\n` +
    `🏠 **Servidores com Constellation:** ${ctx.count}/${ctx.limit}` },

  { id: "linked_servers_label", render: (ctx) => `**Servidores vinculados:**\n${ctx.lista}` },
  { id: "server_line", render: (ctx) => `${ctx.eCurtida} **${ctx.name}** \`(${ctx.guildId})\`` },

  { id: "current_server_label", render: (ctx) => `**Servidor Atual**\n${ctx.status}` },
  { id: "current_active", render: (ctx) => `${ctx.eFeliz} Constellation **ativa** aqui!\n⏳ \`${ctx.tempo}\`` },
  { id: "current_inactive", render: (ctx) =>
    `${ctx.eEmburrada} Constellation **não ativa** neste servidor.\nUse o botão abaixo para ativar!` },

  { id: "btn_activate", render: () => "✨ Ativar neste Servidor" },
  { id: "btn_remove", render: () => "🗑️ Remover deste Servidor" },
  { id: "btn_view_plans", render: () => "✨ Ver Planos Constellation" },

  { id: "buy_plans_alt", render: (ctx) =>
    `✨ **Escolha seu plano:**\n\n` +
    `> 🗓 **Mensal** — R$ 7,99\n` +
    `> 📆 **Trimestral** — R$ 21,99\n` +
    `> 📅 **Semestral** — R$ 39,99\n\n` +
    `${ctx.eCurtida} **Ou adquira um Código Constellation**\n` +
    `> 🔑 Key avulsa — R$ 8,50` },

  { id: "panel_header_alt", render: (ctx) =>
    `# ${ctx.eFesta} Painel Constellation\n` +
    `${ctx.eAnimada} **Assinante:** <@${ctx.userId}>\n` +
    `✨ **Status:** Constellation Ativa\n` +
    `⏳ **Expira em:** \`${ctx.tempo}\`\n\n` +
    `🏠 **Servidores com Constellation:** ${ctx.count}` },
];
