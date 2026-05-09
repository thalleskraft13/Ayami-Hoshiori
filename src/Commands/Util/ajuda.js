const DiscordRequest = require("../../function/DiscordRequest.js");

module.exports = {
  data: {
    name: "ajuda",
    description: "Veja todos os comandos disponíveis",
    type: 1
  },

  async execute(interaction, client) {

    const userId = interaction.member.user.id;

    const pages = {

      inicio: {
        embed: {
          title: "📖 Central de Ajuda",
          description:
`Bem-vindo à central oficial da Arlecchino.

Selecione uma categoria no menu abaixo para visualizar os comandos disponíveis.

> Alguns sistemas ainda estão em desenvolvimento durante a Beta Teste.`,
          color: 5763719,

          footer: {
            text:
"Arlecchino Beta • Novos sistemas serão adicionados futuramente"
          }
        }
      },

      configuracao: {
        embed: {
          title: "⚙️ Configuração",

          description:
[
"`/configurar`",
"",
"> Configure sistemas, tickets e recursos do servidor."
].join("\n"),

          color: 5763719
        }
      },

      economia: {
        embed: {
          title: "💎 Economia",

          description:
[
"## Primogemas",
"`/primogemas saldo`",
"`/primogemas daily`",
"`/primogemas pagar`",
"`/primogemas placar`",
"`/primogemas transações`",
"",
"## Banners",
"`/banners`",
"",
"> Sistemas relacionados à economia e giros."
].join("\n"),

          color: 5763719
        }
      },

      utilidades: {
        embed: {
          title: "🧩 Utilidades",

          description:
[
"`/avatar`",
"`/ping`",
"`/botinfo`",
"`/lembrete`",
"`/notificações`",
"`/uid salvar`",
"`/uid ver`",
"",
"> Ferramentas úteis para o dia a dia."
].join("\n"),

          color: 5763719
        }
      },

      aventureiro: {
        embed: {
          title: "🏆 Rank de Aventureiro",

          description:
[
"`/rank-de-aventureiro ver`",
"`/rank-de-aventureiro placar`",
"",
"> Evolua seu Rank de Aventureiro conversando no servidor."
].join("\n"),

          color: 5763719
        }
      },

      premium: {
        embed: {
          title: "⭐ Premium",

          description:
[
"`/premium`",
"",
"> Benefícios exclusivos e futuras vantagens premium."
].join("\n"),

          color: 5763719
        }
      }
    };

    const render = async (targetInteraction, page) => {

      const current = pages[page];

      const select =
        client.interactions.createSelect({

          user: userId,

          funcao: async (selectInteraction) => {

            const value =
              selectInteraction.data.values[0];

            await render(
              selectInteraction,
              value
            );
          },

          data: {
            placeholder:
              "Selecione uma categoria",

            options: [

              {
                label: "Inicio",
                value: "inicio",
                emoji: {
                  name: "📖"
                },
                description:
                  "Visão geral da central"
              },

              {
                label: "Configuração",
                value: "configuracao",
                emoji: {
                  name: "⚙️"
                },
                description:
                  "Painéis e sistemas"
              },

              {
                label: "Economia",
                value: "economia",
                emoji: {
                  name: "💎"
                },
                description:
                  "Primogemas e banners"
              },

              {
                label: "Utilidades",
                value: "utilidades",
                emoji: {
                  name: "🧩"
                },
                description:
                  "Ferramentas úteis"
              },

              {
                label: "Rank de Aventureiro",
                value: "aventureiro",
                emoji: {
                  name: "🏆"
                },
                description:
                  "Sistema de progressão"
              },

              {
                label: "Premium",
                value: "premium",
                emoji: {
                  name: "⭐"
                },
                description:
                  "Benefícios especiais"
              }
            ]
          }
        });

      await DiscordRequest(
        `/interactions/${targetInteraction.id}/${targetInteraction.token}/callback`,
        {
          method: "POST",

          body: {
            type:
              targetInteraction.type === 3
                ? 7
                : 4,

            data: {
              

              embeds: [
                current.embed
              ],

              components: [
                {
                  type: 1,
                  components: [select]
                }
              ]
            }
          }
        }
      );
    };

    await render(interaction, "inicio");
  }
};