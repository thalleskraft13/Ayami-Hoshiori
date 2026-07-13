"use strict";

module.exports = [
  { id: "gerenciar_title", render: () => "<:ayamianimada:1513895694824378408> Sistema de Sorteios" },
  { id: "gerenciar_desc", render: (ctx) => `**Sorteios ativos:** ${ctx.count}\n\n${ctx.sub}` },
  { id: "gerenciar_select_prompt", render: () => "Selecione um sorteio para gerenciar:" },
  { id: "gerenciar_none", render: () => "Nenhum sorteio ativo.\nUse `/sorteio criar` para criar um!" },

  { id: "lista_none_title", render: () => "<:ayamipensando:1513891183036989533> Nenhum Sorteio Ativo" },
  { id: "lista_none_desc", render: () => "Não há sorteios acontecendo agora!\nFique de olho~" },

  { id: "lista_title", render: () => "<:ayamianimada:1513895694824378408> Sorteios Ativos" },
  { id: "lista_desc", render: (ctx) => `Há **${ctx.count}** sorteio(s) acontecendo agora!` },
  { id: "lista_footer", render: () => "Clique em 🎉 Participar na mensagem do sorteio!" },

  { id: "field_channel", render: (ctx) => `📌 Canal: <#${ctx.channelId}>` },
  { id: "field_participants_inline", render: (ctx) => `👥 Participantes: **${ctx.count}**` },
  { id: "field_winners_inline", render: (ctx) => `🏆 Vencedores: **${ctx.count}**` },
  { id: "paused", render: () => "⏸ Pausado" },
  { id: "ends_relative", render: (ctx) => `Encerra <t:${ctx.ts}:R>` },

  { id: "not_found", render: () => "<:ayamipensando:1513891183036989533> Sorteio não encontrado!" },
  { id: "already_ended", render: () => "<:ayamipensando:1513891183036989533> Este sorteio já foi encerrado!" },
  { id: "ending_progress", render: () => "⏳ Encerrando e sorteando vencedores..." },
  { id: "reroll_only_ended", render: () => "<:ayamipensando:1513891183036989533> Só é possível dar reroll em sorteios **encerrados**!" },
  { id: "reroll_progress", render: () => "⏳ Realizando reroll..." },

  { id: "status_active", render: () => "🟢 Ativo" },
  { id: "status_paused", render: () => "🟡 Pausado" },
  { id: "status_ended", render: () => "🔴 Encerrado" },
  { id: "status_cancelled", render: () => "⚫ Cancelado" },

  { id: "field_status", render: () => "🎯 Status" },
  { id: "field_channel_label", render: () => "📌 Canal" },
  { id: "field_winners", render: () => "🏆 Vencedores" },
  { id: "field_participants", render: () => "👥 Participantes" },
  { id: "field_entries", render: () => "🎟️ Entradas" },
  { id: "field_end_time", render: () => "⏰ Encerramento" },
  { id: "field_bonus_entries", render: () => "✨ Entradas Bônus" },
  { id: "field_requirements", render: () => "📋 Requisitos" },
];
