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
    `> 　 1 servidor com premium · 25 fluxos no Logic Builder\n` +
    `> 　 15 arquivos no Logic Script (até 40 funções/arquivo)\n` +
    `> 　 Tickets avançados (até 10 perguntas, 2 tipos avançados, Modal)\n` +
    `> 　 Configurações e sistemas avançados liberados\n` +
    `> 　 +25% de Primogemas no /daily · chance de 5⭐ sobe pra 20%\n\n` +
    `> 🌙 **Lua Crescente** — R$ 14,99/mês\n` +
    `> 　 3 servidores com premium · 35 fluxos no Logic Builder\n` +
    `> 　 35 arquivos no Logic Script (funções ilimitadas)\n` +
    `> 　 HTTP e Webhooks liberados na Logic Script · \`runFlow()\` por ID\n` +
    `> 　 Tickets com perguntas e tipos avançados ilimitados\n` +
    `> 　 Requisitos avançados de sorteio (servidor externo, nível, XP, call)\n` +
    `> 　 +60% de Primogemas no /daily · chance de 5⭐ sobe pra 27,5%\n` +
    `> 　 Bônus de invocação e recompensas extras\n\n` +
    `> ✨ **Constellation** — R$ 24,99/mês\n` +
    `> 　 Servidores, Logic Builder e Logic Script ilimitados\n` +
    `> 　 Tudo do Lua Crescente, sem limites\n` +
    `> 　 Perfil Personalizado da Ayami no servidor (avatar próprio do bot)\n` +
    `> 　 +100% de Primogemas no /daily · chance de 5⭐ sobe pra 35%\n` +
    `> 　 Acesso antecipado (Early Access) e à Ayami CANARY\n\n` +
    `${ctx.eCurtida} **Ou adquira um Código avulso de qualquer plano**\n` +
    `> 🔑 A compra e a geração de key são feitas no **Servidor Oficial**` },

  { id: "buy_comparison", render: () =>
    `📊 **Comparativo rápido entre os planos:**\n` +
    "```\n" +
    "                     Nova Est.  Lua Cresc.  Constellation\n" +
    "Servidores premium       1          3            ∞\n" +
    "Fluxos Logic Builder     25         35           ∞\n" +
    "Arquivos Logic Script    15         35           ∞\n" +
    "HTTP / Webhooks (LS)     ✖          ✔            ✔\n" +
    "runFlow() por ID         ✖          ✔            ✔\n" +
    "Perguntas por Ticket     10         ∞            ∞\n" +
    "Threads no Ticket        ✔          ✔            ✔\n" +
    "Sorteio avançado         ✖          ✔            ✔\n" +
    "Bônus /daily            +25%       +60%         +100%\n" +
    "Chance total de 5⭐      20%       27,5%         35%\n" +
    "Perfil da Ayami          ✖          ✖            ✔\n" +
    "Early Access / CANARY    ✖          ✖            ✔\n" +
    "```\n" +
    "_Chance base de 5⭐ sem premium: 10%._" },

  { id: "buy_benefits", render: (ctx) =>
    `${ctx.eCorao} **Benefícios exclusivos:**\n\n` +
    `🏅 Cargo exclusivo no Servidor Oficial\n` +
    `⭐ Mais chances ao obter Personagens 5 Estrelas\n` +
    `💎 Bônus de Primogemas no Daily\n` +
    `⚙️ Configurações e sistemas avançados\n` +
    `　*(Tipo de Chat, Form Sequencial, Form por Modal,*\n` +
    `　*Cargos Temporários, Ticket Setup, Threads e muito mais)*\n` +
    `🔗 Uso de Webhook em Sistemas (Aniversário, notificações e mais)\n` +
    `📌 Botão Fixo no Sistema de Aniversário\n` +
    `🌐 HTTP e Webhooks personalizados na Logic Script _(a partir de 🌙 Lua Crescente)_\n` +
    `👤 Perfil Personalizado da Ayami no servidor _(exclusivo ✨ Constellation)_` },

  { id: "buy_footer", render: (ctx) =>
    `${ctx.ePensando} *Constellation não é só um plano.*\n*É o seu lugar entre as estrelas.* ${ctx.eSria}\n\n` +
    `🛒 *Assinaturas e keys avulsas são adquiridas exclusivamente no **Servidor Oficial** da Ayami.*` },

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
