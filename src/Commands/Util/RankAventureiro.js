'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");

module.exports = {
  data: {
    name: "rank-de-aventureiro",
    description: "Comandos relacionados ao Rank de Aventureiro",
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

      const texto = isSelf
        ? `${emoji.animada} Você está no **Rank de Aventureiro ${Ar}** com \`${xpAtual} XP\`!\nFaltam apenas \`${xpRestante} XP\` pro próximo rank!\n\n-# ${emoji.sria} Continue crescendo. Eu observo cada passo seu… e espero progresso.`
        : `${emoji.feliz} [${userName}](https://discord.com/users/${targetId}) está no **Rank de Aventureiro ${Ar}** com \`${xpAtual} XP\`!\nFaltam apenas \`${xpRestante} XP\` pro próximo rank!\n\n-# ${emoji.sria} Eu observo cada aventureiro… e espero progresso de todos.`;

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
                          content: `# ${emoji.default} Rank de Aventureiro`
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
                    title: `${emoji.emduvida} Nenhum aventureiro ainda!`,
                    description: `${emoji.emburrada} Parece que ninguém subiu de rank ainda...\n\nVá lá e seja o primeiro! ${emoji.animada}`,
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

      const generateDescription = async (pageIndex) => {

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
            user = { username: "Aventureiro Desconhecido" };
          }

          const name = user.global_name || user.username;
          const prefix = medalhas[position - 1] ?? `**#${position}**`;

          lines.push(
            `${prefix} [${name}](https://discord.com/users/${u.userId}) • Rank ${u.rankaventureiro.nivelAtual} \`(${u.rankaventureiro.xpTotal} XP)\``
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

        const description = await generateDescription(newPage);

        const isFirst = newPage === 0;
        const isLast = newPage === totalPages - 1;

        const embed = {
          title: `${emoji.festa} Ranking de Aventureiros`,
          description:
            `${emoji.animada} *Os maiores aventureiros estão aqui!*\n\n` +
            description,
          color: 0x7B5EA7,
          footer: {
            text: `Página ${newPage + 1} de ${totalPages} • Ayami Hoshiori`
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
