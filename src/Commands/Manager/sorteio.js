'use strict';

const getPerm        = require("../../function/Utils/GetPerm.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const GiveawayDb     = require("../../Mongodb/giveaway.js");

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

    /* ── Subcommands admin ─────────────────────────────── */

    const adminOnly = ['criar', 'gerenciar', 'encerrar', 'reroll'];

    if (adminOnly.includes(subcommand)) {

      const perms = await getPerm({ id: user, guildId });

      if (!perms || !perms.includes("MANAGE_GUILD")) {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                content: "❌ Você precisa da permissão **Gerenciar Servidor** para usar este subcomando.",
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
                title: "<:ayamianimada:1513895694824378408> Sistema de Sorteios",
                description:
                  `**Sorteios ativos:** ${actives.length}\n\n` +
                  (actives.length
                    ? `Selecione um sorteio para gerenciar:`
                    : `Nenhum sorteio ativo.\nUse \`/sorteio criar\` para criar um!`),
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
                  title: "<:ayamipensando:1513891183036989533> Nenhum Sorteio Ativo",
                  description: "Não há sorteios acontecendo agora!\nFique de olho~",
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
            `📌 Canal: <#${g.channelId}>`,
            `👥 Participantes: **${g.participants.length}**`,
            `🏆 Vencedores: **${g.winners}**`,
            `⏰ ${isPaused ? "⏸ Pausado" : `Encerra <t:${endsTs}:R>`}`,
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
                title: "<:ayamianimada:1513895694824378408> Sorteios Ativos",
                description: `Há **${actives.length}** sorteio(s) acontecendo agora!`,
                fields,
                color: 0xFFB7C5,
                footer: { text: "Clique em 🎉 Participar na mensagem do sorteio!" }
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
            body: { type: 4, data: { content: "<:ayamipensando:1513891183036989533> Sorteio não encontrado!", flags: 64 } }
          }
        );
      }

      if (doc.status === "ended") {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: { type: 4, data: { content: "<:ayamipensando:1513891183036989533> Este sorteio já foi encerrado!", flags: 64 } }
          }
        );
      }

      // ACK antes de sortear (pode demorar)
      await DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: { type: 4, data: { content: "⏳ Encerrando e sorteando vencedores...", flags: 64 } }
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
            body: { type: 4, data: { content: "<:ayamipensando:1513891183036989533> Sorteio não encontrado!", flags: 64 } }
          }
        );
      }

      if (doc.status !== "ended") {
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: { type: 4, data: { content: "<:ayamipensando:1513891183036989533> Só é possível dar reroll em sorteios **encerrados**!", flags: 64 } }
          }
        );
      }

      await DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: { type: 4, data: { content: "⏳ Realizando reroll...", flags: 64 } }
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
            body: { type: 4, data: { content: "<:ayamipensando:1513891183036989533> Sorteio não encontrado!", flags: 64 } }
          }
        );
      }

      const statusMap = {
        active: '🟢 Ativo', paused: '🟡 Pausado',
        ended: '🔴 Encerrado', cancelled: '⚫ Cancelado'
      };

      const endsTs   = Math.floor(new Date(doc.endsAt).getTime() / 1000);
      const total    = doc.participants.length;
      const totalEnt = doc.participants.reduce((a, p) => a + p.totalEntries, 0);

      const fields = [
        { name: '🎯 Status',        value: statusMap[doc.status],  inline: true },
        { name: '📌 Canal',         value: `<#${doc.channelId}>`,  inline: true },
        { name: '🏆 Vencedores',    value: String(doc.winners),    inline: true },
        { name: '👥 Participantes', value: String(total),          inline: true },
        { name: '🎟️ Entradas',     value: String(totalEnt),       inline: true },
        { name: '⏰ Encerramento',  value: `<t:${endsTs}:F>`,      inline: true },
      ];

      if (doc.bonusEntries?.length) {
        fields.push({
          name:  '✨ Entradas Bônus',
          value: doc.bonusEntries.map(b => `<@&${b.roleId}> → +${b.entries}`).join('\n')
        });
      }

      if (doc.requirements?.length) {
        fields.push({
          name:  '📋 Requisitos',
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
        if (winnerList) fields.push({ name: '🏆 Vencedores', value: winnerList });
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
