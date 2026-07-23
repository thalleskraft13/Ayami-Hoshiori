'use strict';

const getPerm        = require("../../function/Utils/GetPerm.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const GiveawayDb     = require("../../Mongodb/giveaway.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

module.exports = {

  data: {
    name: "sorteio",
    description: "Sistema de sorteios da Ayami",
    name_localizations: { 'en-US': 'giveaway', 'en-GB': 'giveaway', 'es-ES': 'sorteo' },
    description_localizations: {
      'en-US': "Ayami's giveaway system",
      'en-GB': "Ayami's giveaway system",
      'es-ES': 'Sistema de sorteos de Ayami',
    },
    options: [
      {
        type: 1, // SUB_COMMAND
        name: "criar",
        description: "Cria um novo sorteio",
        name_localizations: { 'en-US': 'create', 'en-GB': 'create', 'es-ES': 'crear' },
        description_localizations: {
          'en-US': 'Create a new giveaway',
          'en-GB': 'Create a new giveaway',
          'es-ES': 'Crea un nuevo sorteo',
        }
      },
      {
        type: 1,
        name: "gerenciar",
        description: "Gerencia os sorteios ativos do servidor",
        name_localizations: { 'en-US': 'manage', 'en-GB': 'manage', 'es-ES': 'gestionar' },
        description_localizations: {
          'en-US': "Manage the server's active giveaways",
          'en-GB': "Manage the server's active giveaways",
          'es-ES': 'Gestiona los sorteos activos del servidor',
        }
      },
      {
        type: 1,
        name: "lista",
        description: "Veja todos os sorteios ativos do servidor",
        name_localizations: { 'en-US': 'list', 'en-GB': 'list', 'es-ES': 'lista' },
        description_localizations: {
          'en-US': "See all of the server's active giveaways",
          'en-GB': "See all of the server's active giveaways",
          'es-ES': 'Consulta todos los sorteos activos del servidor',
        }
      },
      {
        type: 1,
        name: "encerrar",
        description: "Encerra um sorteio manualmente",
        name_localizations: { 'en-US': 'end', 'en-GB': 'end', 'es-ES': 'finalizar' },
        description_localizations: {
          'en-US': 'Manually end a giveaway',
          'en-GB': 'Manually end a giveaway',
          'es-ES': 'Finaliza un sorteo manualmente',
        },
        options: [
          {
            type: 3, // STRING
            name: "id",
            description: "ID do sorteio",
            required: true,
            name_localizations: { 'en-US': 'id', 'en-GB': 'id', 'es-ES': 'id' },
            description_localizations: {
              'en-US': 'Giveaway ID',
              'en-GB': 'Giveaway ID',
              'es-ES': 'ID del sorteo',
            }
          }
        ]
      },
      {
        type: 1,
        name: "reroll",
        description: "Refaz o sorteio de um giveaway encerrado",
        name_localizations: { 'en-US': 'reroll', 'en-GB': 'reroll', 'es-ES': 'reroll' },
        description_localizations: {
          'en-US': 'Redraw the winners of an ended giveaway',
          'en-GB': 'Redraw the winners of an ended giveaway',
          'es-ES': 'Vuelve a sortear los ganadores de un sorteo finalizado',
        },
        options: [
          {
            type: 3,
            name: "id",
            description: "ID do sorteio",
            required: true,
            name_localizations: { 'en-US': 'id', 'en-GB': 'id', 'es-ES': 'id' },
            description_localizations: {
              'en-US': 'Giveaway ID',
              'en-GB': 'Giveaway ID',
              'es-ES': 'ID del sorteo',
            }
          }
        ]
      },
      {
        type: 1,
        name: "info",
        description: "Veja detalhes e estatísticas de um sorteio",
        name_localizations: { 'en-US': 'info', 'en-GB': 'info', 'es-ES': 'info' },
        description_localizations: {
          'en-US': 'See details and stats for a giveaway',
          'en-GB': 'See details and stats for a giveaway',
          'es-ES': 'Consulta detalles y estadísticas de un sorteo',
        },
        options: [
          {
            type: 3,
            name: "id",
            description: "ID do sorteio",
            required: true,
            name_localizations: { 'en-US': 'id', 'en-GB': 'id', 'es-ES': 'id' },
            description_localizations: {
              'en-US': 'Giveaway ID',
              'en-GB': 'Giveaway ID',
              'es-ES': 'ID del sorteo',
            }
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


    if (subcommand === "criar") {
      return client.giveaway.criar(interaction);
    }


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

      await DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: { type: 4, data: { content: client.t("sorteio.ending_progress", ctx), flags: 64 } }
        }
      );

      return client.giveaway.endGiveaway(interaction, doc);
    }


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
