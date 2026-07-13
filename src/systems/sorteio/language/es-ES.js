"use strict";

module.exports = [
  { id: "gerenciar_title", render: () => "<:ayamianimada:1513895694824378408> Sistema de Sorteos" },
  { id: "gerenciar_desc", render: (ctx) => `**Sorteos activos:** ${ctx.count}\n\n${ctx.sub}` },
  { id: "gerenciar_select_prompt", render: () => "Selecciona un sorteo para gestionar:" },
  { id: "gerenciar_none", render: () => "No hay sorteos activos.\n¡Usa `/sorteio criar` para crear uno!" },

  { id: "lista_none_title", render: () => "<:ayamipensando:1513891183036989533> Ningún Sorteo Activo" },
  { id: "lista_none_desc", render: () => "¡No hay sorteos en curso ahora mismo!\nMantente atento~" },

  { id: "lista_title", render: () => "<:ayamianimada:1513895694824378408> Sorteos Activos" },
  { id: "lista_desc", render: (ctx) => `¡Hay **${ctx.count}** sorteo(s) en curso ahora mismo!` },
  { id: "lista_footer", render: () => "¡Haz clic en 🎉 Participar en el mensaje del sorteo!" },

  { id: "field_channel", render: (ctx) => `📌 Canal: <#${ctx.channelId}>` },
  { id: "field_participants_inline", render: (ctx) => `👥 Participantes: **${ctx.count}**` },
  { id: "field_winners_inline", render: (ctx) => `🏆 Ganadores: **${ctx.count}**` },
  { id: "paused", render: () => "⏸ Pausado" },
  { id: "ends_relative", render: (ctx) => `Termina <t:${ctx.ts}:R>` },

  { id: "not_found", render: () => "<:ayamipensando:1513891183036989533> ¡Sorteo no encontrado!" },
  { id: "already_ended", render: () => "<:ayamipensando:1513891183036989533> ¡Este sorteo ya ha terminado!" },
  { id: "ending_progress", render: () => "⏳ Terminando y sorteando ganadores..." },
  { id: "reroll_only_ended", render: () => "<:ayamipensando:1513891183036989533> ¡Solo puedes repetir el sorteo en sorteos **terminados**!" },
  { id: "reroll_progress", render: () => "⏳ Repitiendo el sorteo..." },

  { id: "status_active", render: () => "🟢 Activo" },
  { id: "status_paused", render: () => "🟡 Pausado" },
  { id: "status_ended", render: () => "🔴 Terminado" },
  { id: "status_cancelled", render: () => "⚫ Cancelado" },

  { id: "field_status", render: () => "🎯 Estado" },
  { id: "field_channel_label", render: () => "📌 Canal" },
  { id: "field_winners", render: () => "🏆 Ganadores" },
  { id: "field_participants", render: () => "👥 Participantes" },
  { id: "field_entries", render: () => "🎟️ Entradas" },
  { id: "field_end_time", render: () => "⏰ Finalización" },
  { id: "field_bonus_entries", render: () => "✨ Entradas Extra" },
  { id: "field_requirements", render: () => "📋 Requisitos" },
];
