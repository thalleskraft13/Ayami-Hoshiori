'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

module.exports = {
  data: {
    name: "rank-de-aventureiro",
    description: "Comandos relacionados ao Rank de Aventureiro",
    name_localizations: { 'en-US': 'adventurer-rank', 'en-GB': 'adventurer-rank', 'es-ES': 'rango-de-aventurero' },
    description_localizations: {
      'en-US': 'Commands related to the Adventurer Rank',
      'en-GB': 'Commands related to the Adventurer Rank',
      'es-ES': 'Comandos relacionados con el Rango de Aventurero',
    },
    type: 1,
    options: [
      {
        name: "ver",
        description: "Veja seu Rank de Aventureiro atual",
        type: 1,
        options: [
          {
            name: "usuario",
            description: "Mencione ou insira o ID",
            type: 6,
            required: false
          }
        ]
      },
      {
        name: "placar",
        description: "Veja os maiores aventureiros",
        type: 1
      }
    ]
  },

  async execute(interaction, client) {

    const subcommand = interaction.data.options[0];
    const authorId = interaction.member.user.id;
    const emoji = client.emoji;

    // ──────────────────────────────────────────
    //  VER
    // ──────────────────────────────────────────
    if (subcommand.name === "ver") {

      const mentionedUser = subcommand.options?.[0]?.value;
      const targetId = mentionedUser || authorId;

      let userdb = await db.findOne({ userId: targetId });

      if (!userdb) {
        const newuser = new db({ userId: targetId });
        await newuser.save();
        userdb = await db.findOne({ userId: targetId });
      }

      const Ar = userdb.rankaventureiro.nivelAtual;
      const xpAtual = userdb.rankaventureiro.xpTotal;
      const xpRestante = userdb.rankaventureiro.xpRestante;

      const user = await DiscordRequest(`/users/${targetId}`, {
        method: "GET"
      });

      const isSelf = targetId === authorId;
      const userName = user.global_name || user.username;
      const userUrl = `https://discord.com/users/${targetId}`;

      const ctx = localeCtx(interaction, {
        eAnimada: emoji.animada,
        eSria: emoji.sria,
        eFeliz: emoji.feliz,
        eDefault: emoji.default,
        ar: Ar,
        xpAtual,
        xpRestante,
        userName,
        userUrl,
      });

      const texto = isSelf
        ? client.t("rank_aventureiro.self_text", ctx)
        : client.t("rank_aventureiro.other_text", ctx);

      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              flags: 32768,
              components: [
                {
                  type: 17,
                  accent_color: 0x7B5EA7,
                  spoiler: false,
                  components: [
                    {
                      type: 9,
                      accessory: {
                        type: 11,
                        media: { url: getAvatarURL(user) },
                        description: null,
                        spoiler: false
                      },
                      components: [
                        {
                          type: 10,
                          content: client.t("rank_aventureiro.header", ctx)
                        }
                      ]
                    },
                    {
                      type: 10,
                      content: texto
                    }
                  ]
                }
              ]
            }
          }
        }
      );
    }

    // ──────────────────────────────────────────
    //  PLACAR
    // ──────────────────────────────────────────
    if (subcommand.name === "placar") {

      const pageSize = 10;
      let page = 0;

      const users = await db.find({
        "rankaventureiro.nivelAtual": { $gt: 0 }
      }).sort({
        "rankaventureiro.nivelAtual": -1
      });

      if (!users.length) {
        const ctxEmpty = localeCtx(interaction, {
          eEmduvida: emoji.emduvida,
          eEmburrada: emoji.emburrada,
          eAnimada: emoji.animada,
        });
        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                flags: 64,
                embeds: [
                  {
                    title: client.t("rank_aventureiro.empty_title", ctxEmpty),
                    description: client.t("rank_aventureiro.empty_desc", ctxEmpty),
                    color: 0x7B5EA7
                  }
                ]
              }
            }
          }
        );
      }

      const totalPages = Math.ceil(users.length / pageSize);

      const medalhas = ["🥇", "🥈", "🥉"];

      const generateDescription = async (pageIndex, ctx) => {

        const start = pageIndex * pageSize;
        const current = users.slice(start, start + pageSize);
        const lines = [];

        for (let i = 0; i < current.length; i++) {

          const u = current[i];
          const position = start + i + 1;

          let user;
          try {
            user = await DiscordRequest(`/users/${u.userId}`, { method: "GET" });
          } catch {
            user = { username: client.t("rank_aventureiro.unknown_adventurer", ctx) };
          }

          const name = user.global_name || user.username;
          const prefix = medalhas[position - 1] ?? `**#${position}**`;

          lines.push(
            client.t("rank_aventureiro.rank_line", {
              ...ctx,
              prefix,
              name,
              userUrl: `https://discord.com/users/${u.userId}`,
              nivel: u.rankaventureiro.nivelAtual,
              xp: u.rankaventureiro.xpTotal,
            })
          );
        }

        return lines.join("\n");
      };

      const updateMessage = async (btnInteraction, newPage) => {

        if (newPage < 0) newPage = 0;
        if (newPage >= totalPages) newPage = totalPages - 1;

        const userId = btnInteraction.member.user.id;

        const prevBtn = client.interactions.createButton({
          user: userId,
          funcao: async (btnInt) => updateMessage(btnInt, newPage - 1),
          data: { label: "⬅️", style: 2 }
        });

        const nextBtn = client.interactions.createButton({
          user: userId,
          funcao: async (btnInt) => updateMessage(btnInt, newPage + 1),
          data: { label: "➡️", style: 2 }
        });

        const ctx = localeCtx(btnInteraction, {
          eFesta: emoji.festa,
          eAnimada: emoji.animada,
        });

        const description = await generateDescription(newPage, ctx);

        const isFirst = newPage === 0;
        const isLast = newPage === totalPages - 1;

        const embed = {
          title: client.t("rank_aventureiro.leaderboard_title", ctx),
          description:
            `${client.t("rank_aventureiro.leaderboard_intro", ctx)}\n\n` +
            description,
          color: 0x7B5EA7,
          footer: {
            text: client.t("rank_aventureiro.footer", { ...ctx, page: newPage + 1, totalPages })
          }
        };

        const row = {
          type: 1,
          components: [
            { ...prevBtn, disabled: isFirst },
            { ...nextBtn, disabled: isLast }
          ]
        };

        return DiscordRequest(
          `/interactions/${btnInteraction.id}/${btnInteraction.token}/callback`,
          {
            method: "POST",
            body: {
              type: btnInteraction.message ? 7 : 4,
              data: {
                embeds: [embed],
                components: [row]
              }
            }
          }
        );
      };

      return updateMessage(interaction, page);
    }
  }
};

// ──────────────────────────────────────────
//  HELPER
// ──────────────────────────────────────────

function getAvatarURL(user) {
  if (!user.avatar)
    return `https://cdn.discordapp.com/embed/avatars/0.png`;

  const isGif = user.avatar.startsWith("a_");
  const ext = isGif ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=1024`;
}
