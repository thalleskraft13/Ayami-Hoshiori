'use strict';

const getPerm        = require("../../function/Utils/GetPerm.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const GiveawayDb     = require("../../Mongodb/giveaway.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

module.exports = {

  data: {
    name: "sorteio",
    description: "Sistema de sorteios da Ayami",
    options: [
      {
        type: 1, // SUB_COMMAND
        name: "criar",
        description: "Cria um novo sorteio"
      },
      {
        type: 1,
        name: "gerenciar",
        description: "Gerencia os sorteios ativos do servidor"
      },
      {
        type: 1,
        name: "lista",
        description: "Veja todos os sorteios ativos do servidor"
      },
      {
        type: 1,
        name: "encerrar",
        description: "Encerra um sorteio manualmente",
        options: [
          {
            type: 3, // STRING
            name: "id",
            description: "ID do sorteio",
            required: true
          }
        ]
      },
      {
        type: 1,
        name: "reroll",
        description: "Refaz o sorteio de um giveaway encerrado",
        options: [
          {
            type: 3,
            name: "id",
            description: "ID do sorteio",
            required: true
          }
        ]
      },
      {
        type: 1,
        name: "info",
        description: "Veja detalhes e estatísticas de um sorteio",
        options: [
          {
            type: 3,
            name: "id",
            description: "ID do sorteio",
            required: true
          }
        ]
      }
    ]
  },

  info: {
    perm: []
  },

  async execute(interaction, client) {

    const subcommand = interaction.data.options?.[0]?.name;
    const user       = interaction.member.user.id;
    const guildId    = interaction.guild_id;
    const ctx        = localeCtx(interaction);

    /* ── Subcommands admin ─────────────────────────────── */

    const adminOnly = ['criar', 'gerenciar', 'encerrar', 'reroll'];

    if (adminOnly.includes(subcommand)) {

      const perms = await getPerm({ id: user, guildId, client });

      if (!perms || !perms.includes("MANAGE_GUILD")) {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                content: client.t("common.no_permission", {
                  ...ctx,
                  perm: client.t("common.perm_manage_guild", ctx),
                  action: client.t("common.action_use_subcommand", ctx),
                }),
                flags: 64
              }
            }
          }
        );
      }
    }

    /* ══════════════════════════════════════════════
       /sorteio criar
       Abre 1 modal (interação virgem = válido).
       O restante do fluxo é 100% por chat.
    ══════════════════════════════════════════════ */

    if (subcommand === "criar") {
      return client.giveaway.criar(interaction);
    }

    /* ══════════════════════════════════════════════
       /sorteio gerenciar
    ══════════════════════════════════════════════ */

    if (subcommand === "gerenciar") {

      const actives = await GiveawayDb.find({
        guildId,
        status: { $in: ["active", "paused"] }
      }).lean();

      await DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              embeds: [{
                title: client.t("sorteio.gerenciar_title", ctx),
                description: client.t("sorteio.gerenciar_desc", {
                  ...ctx,
                  count: actives.length,
                  sub: actives.length
                    ? client.t("sorteio.gerenciar_select_prompt", ctx)
                    : client.t("sorteio.gerenciar_none", ctx),
                }),
                color: 0xFFB7C5
              }],
              components: [],
              flags: 64
            }
          }
        }
      );

      return client.giveaway.startMenu(interaction);
    }

    /* ══════════════════════════════════════════════
       /sorteio lista  (qualquer usuário)
    ══════════════════════════════════════════════ */

    if (subcommand === "lista") {

      const actives = await GiveawayDb.find({
        guildId,
        status: { $in: ["active", "paused"] }
      }).lean();

      if (!actives.length) {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                embeds: [{
                  title: client.t("sorteio.lista_none_title", ctx),
                  description: client.t("sorteio.lista_none_desc", ctx),
                  color: 0xFFB7C5
                }],
                flags: 64
              }
            }
          }
        );
      }

      const fields = actives.map(g => {
        const endsTs   = Math.floor(new Date(g.endsAt).getTime() / 1000);
        const isPaused = g.status === "paused";
        return {
          name: `🎉 ${g.prize.slice(0, 80)}`,
          value: [
            client.t("sorteio.field_channel", { ...ctx, channelId: g.channelId }),
            client.t("sorteio.field_participants_inline", { ...ctx, count: g.participants.length }),
            client.t("sorteio.field_winners_inline", { ...ctx, count: g.winners }),
            `⏰ ${isPaused ? client.t("sorteio.paused", ctx) : client.t("sorteio.ends_relative", { ...ctx, ts: endsTs })}`,
            `\`ID: ${g.giveawayId}\``,
          ].join("\n")
        };
      });

      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              embeds: [{
                title: client.t("sorteio.lista_title", ctx),
                description: client.t("sorteio.lista_desc", { ...ctx, count: actives.length }),
                fields,
                color: 0xFFB7C5,
                footer: { text: client.t("sorteio.lista_footer", ctx) }
              }]
            }
          }
        }
      );
    }

    /* ══════════════════════════════════════════════
       /sorteio encerrar <id>
    ══════════════════════════════════════════════ */

    if (subcommand === "encerrar") {

      const giveawayId = interaction.data.options[0].options?.find(o => o.name === "id")?.value?.trim();
      const doc        = await GiveawayDb.findOne({ giveawayId, guildId });

      if (!doc) {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: { type: 4, data: { content: client.t("sorteio.not_found", ctx), flags: 64 } }
          }
        );
      }

      if (doc.status === "ended") {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: { type: 4, data: { content: client.t("sorteio.already_ended", ctx), flags: 64 } }
          }
        );
      }

      // ACK antes de sortear (pode demorar)
      await DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: { type: 4, data: { content: client.t("sorteio.ending_progress", ctx), flags: 64 } }
        }
      );

      return client.giveaway.endGiveaway(interaction, doc);
    }

    /* ══════════════════════════════════════════════
       /sorteio reroll <id>
    ══════════════════════════════════════════════ */

    if (subcommand === "reroll") {

      const giveawayId = interaction.data.options[0].options?.find(o => o.name === "id")?.value?.trim();
      const doc        = await GiveawayDb.findOne({ giveawayId, guildId });

      if (!doc) {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: { type: 4, data: { content: client.t("sorteio.not_found", ctx), flags: 64 } }
          }
        );
      }

      if (doc.status !== "ended") {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: { type: 4, data: { content: client.t("sorteio.reroll_only_ended", ctx), flags: 64 } }
          }
        );
      }

      await DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: { type: 4, data: { content: client.t("sorteio.reroll_progress", ctx), flags: 64 } }
        }
      );

      return client.giveaway.reroll(interaction, doc, user);
    }

    /* ══════════════════════════════════════════════
       /sorteio info <id>  (qualquer usuário)
    ══════════════════════════════════════════════ */

    if (subcommand === "info") {

      const giveawayId = interaction.data.options[0].options?.find(o => o.name === "id")?.value?.trim();
      const doc        = await GiveawayDb.findOne({ giveawayId, guildId }).lean();

      if (!doc) {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: { type: 4, data: { content: client.t("sorteio.not_found", ctx), flags: 64 } }
          }
        );
      }

      const statusMap = {
        active: client.t("sorteio.status_active", ctx),
        paused: client.t("sorteio.status_paused", ctx),
        ended: client.t("sorteio.status_ended", ctx),
        cancelled: client.t("sorteio.status_cancelled", ctx)
      };

      const endsTs   = Math.floor(new Date(doc.endsAt).getTime() / 1000);
      const total    = doc.participants.length;
      const totalEnt = doc.participants.reduce((a, p) => a + p.totalEntries, 0);

      const fields = [
        { name: client.t("sorteio.field_status", ctx),        value: statusMap[doc.status],  inline: true },
        { name: client.t("sorteio.field_channel_label", ctx), value: `<#${doc.channelId}>`,  inline: true },
        { name: client.t("sorteio.field_winners", ctx),       value: String(doc.winners),    inline: true },
        { name: client.t("sorteio.field_participants", ctx),  value: String(total),          inline: true },
        { name: client.t("sorteio.field_entries", ctx),       value: String(totalEnt),       inline: true },
        { name: client.t("sorteio.field_end_time", ctx),      value: `<t:${endsTs}:F>`,      inline: true },
      ];

      if (doc.bonusEntries?.length) {
        fields.push({
          name:  client.t("sorteio.field_bonus_entries", ctx),
          value: doc.bonusEntries.map(b => `<@&${b.roleId}> → +${b.entries}`).join('\n')
        });
      }

      if (doc.requirements?.length) {
        fields.push({
          name:  client.t("sorteio.field_requirements", ctx),
          value: doc.requirements
            .map(r => `• ${client.giveaway._reqLabel(r)}`)
            .join('\n')
            .slice(0, 1000)
        });
      }

      if (doc.status === 'ended') {
        const winnerList = doc.participants
          .filter(p => p.status === 'winner')
          .map(p => `<@${p.userId}>`)
          .join(', ');
        if (winnerList) fields.push({ name: client.t("sorteio.field_winners", ctx), value: winnerList });
      }

      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              embeds: [{
                title: `<:ayamianimada:1513895694824378408> ${doc.prize}`,
                description: doc.description || null,
                fields,
                color: doc.color ?? 0xFFB7C5,
                thumbnail: doc.thumbnail ? { url: doc.thumbnail } : undefined,
                footer: { text: `ID: ${doc.giveawayId}` }
              }],
              flags: 64
            }
          }
        }
      );
    }
  }
};
