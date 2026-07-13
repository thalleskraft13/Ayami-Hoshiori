"use strict";

module.exports = [
  { id: "gerenciar_title", render: () => "<:ayamianimada:1513895694824378408> Giveaway System" },
  { id: "gerenciar_desc", render: (ctx) => `**Active giveaways:** ${ctx.count}\n\n${ctx.sub}` },
  { id: "gerenciar_select_prompt", render: () => "Pick a giveaway to manage:" },
  { id: "gerenciar_none", render: () => "No active giveaways.\nUse `/sorteio criar` to create one!" },

  { id: "lista_none_title", render: () => "<:ayamipensando:1513891183036989533> No Active Giveaways" },
  { id: "lista_none_desc", render: () => "There are no giveaways running right now!\nKeep an eye out~" },

  { id: "lista_title", render: () => "<:ayamianimada:1513895694824378408> Active Giveaways" },
  { id: "lista_desc", render: (ctx) => `There ${ctx.count === 1 ? 'is' : 'are'} **${ctx.count}** giveaway(s) running right now!` },
  { id: "lista_footer", render: () => "Click 🎉 Enter on the giveaway message!" },

  { id: "field_channel", render: (ctx) => `📌 Channel: <#${ctx.channelId}>` },
  { id: "field_participants_inline", render: (ctx) => `👥 Entrants: **${ctx.count}**` },
  { id: "field_winners_inline", render: (ctx) => `🏆 Winners: **${ctx.count}**` },
  { id: "paused", render: () => "⏸ Paused" },
  { id: "ends_relative", render: (ctx) => `Ends <t:${ctx.ts}:R>` },

  { id: "not_found", render: () => "<:ayamipensando:1513891183036989533> Giveaway not found!" },
  { id: "already_ended", render: () => "<:ayamipensando:1513891183036989533> This giveaway has already ended!" },
  { id: "ending_progress", render: () => "⏳ Ending and picking winners..." },
  { id: "reroll_only_ended", render: () => "<:ayamipensando:1513891183036989533> You can only reroll **ended** giveaways!" },
  { id: "reroll_progress", render: () => "⏳ Rerolling..." },

  { id: "status_active", render: () => "🟢 Active" },
  { id: "status_paused", render: () => "🟡 Paused" },
  { id: "status_ended", render: () => "🔴 Ended" },
  { id: "status_cancelled", render: () => "⚫ Cancelled" },

  { id: "field_status", render: () => "🎯 Status" },
  { id: "field_channel_label", render: () => "📌 Channel" },
  { id: "field_winners", render: () => "🏆 Winners" },
  { id: "field_participants", render: () => "👥 Entrants" },
  { id: "field_entries", render: () => "🎟️ Entries" },
  { id: "field_end_time", render: () => "⏰ End Time" },
  { id: "field_bonus_entries", render: () => "✨ Bonus Entries" },
  { id: "field_requirements", render: () => "📋 Requirements" },
];
