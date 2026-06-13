const DiscordRequest = require("../../function/DiscordRequest.js");

module.exports = {
  data: {
    name: "ajuda",
    description: "Veja todos os comandos disponíveis",
    type: 1
  },

  async execute(interaction, client) {

    const userId = interaction.member.user.id;

    // Emojis da Ayami
    const e = client.emoji;

    // Cor principal: Azul Secundário da paleta (#7C8FFF → decimal)
    const COR = 0x7C8FFF;

    const pages = {

      inicio: {
        embed: {
          title: `${e.feliz} Central de Ajuda — Ayami Hoshiori`,
          description:
[
`Oi, oi~! Eu sou a **Ayami** ${e.default} e estou aqui pra te ajudar!`,
``,
`Usa o menu abaixinho pra navegar pelas categorias e ver tudo que eu consigo fazer por você. ${e.corao}`,
``,
`> ${e.pensando} *Alguns sistemas ainda estão em desenvolvimento. Obrigada pela paciência~!*`
].join("\n"),
          color: COR,
          footer: {
            text: "Ayami Hoshiori • Novos sistemas chegando em breve ✨"
          }
        }
      },

      configuracao: {
        embed: {
          title: `⚙️ Configuração ${e.sria}`,
          description:
[
`Aqui você configura tudo do servidor! ${e.animada}`,
``,
`\`/configurar\``,
``,
`> Configure sistemas, tickets e recursos do servidor com facilidade.`
].join("\n"),
          color: COR
        }
      },

      economia: {
        embed: {
          title: `💎 Economia ${e.festa}`,
          description:
[
`## ✨ Primogemas`,
`\`/primogemas saldo\``,
`\`/primogemas daily\``,
`\`/primogemas pagar\``,
`\`/primogemas placar\``,
`\`/primogemas transferências\``,
``,
`## 🎴 Banners`,
`\`/banner\``,
``,
`> ${e.curtida} Ganhe, gaste e gire — tudo com Primogemas!`
].join("\n"),
          color: COR
        }
      },

      exploracao: {
        embed: {
          title: `🗺️ Exploração ${e.animada}`,
          description:
[
`## 🌿 Regiões`,
`\`/explorar mondstadt\` — *Explore a Cidade da Liberdade!*`,
`\`/explorar tempo\` — *Veja quanto tempo falta para explorar*`,
``,
`> ${e.emduvida} Novas regiões chegam em breve, fique de olho~!`
].join("\n"),
          color: COR
        }
      },

      missoes: {
        embed: {
          title: `📋 Missões ${e.pensando}`,
          description:
[
`## 📌 Pessoais`,
`\`/missoes ver\` — *Missões diárias e semanais*`,
``,
`## 🏛️ Guilda`,
`\`/missoes guilda\` — *Missões semanais e eventos do servidor*`,
``,
`## 👥 Grupo`,
`\`/missoes grupo ver\``,
`\`/missoes grupo criar\``,
`\`/missoes grupo entrar\``,
`\`/missoes grupo sair\``,
`\`/missoes grupo gerenciar\``,
``,
`> ${e.corao} Complete missões e evolua junto com seus amigos!`
].join("\n"),
          color: COR
        }
      },

      utilidades: {
        embed: {
          title: `🧩 Utilidades ${e.rindo}`,
          description:
[
`\`/usuario avatar\` — *Avatar de qualquer membro*`,
`\`/ping\` — *Latência, cluster e shard*`,
`\`/botinfo\` — *Informações sobre mim~* ${e.default}`,
`\`/lembrete\` — *Receba um lembrete no DM*`,
`\`/notificações\` — *Ative ou desative notificações por DM*`,
`\`/uid salvar\` — *Salve seu UID do jogo*`,
`\`/uid ver\` — *Veja o UID de outro membro*`,
`\`/personagens\` — *Veja seus personagens obtidos*`,
``,
`> ${e.feliz} Ferramentas pra tornar tudo mais fácil!`
].join("\n"),
          color: COR
        }
      },

      criacao: {
        embed: {
          title: `🎨 Criação ${e.animada}`,
          description:
[
`\`/criar embed\` — *Editor avançado de Embed com preview ao vivo*`,
`\`/criar componentsv2\` — *Editor visual de Components V2*`,
`\`/criar editar\` — *Reabrir e editar uma mensagem salva*`,
``,
`## 📚 Biblioteca de Fluxos`,
`\`/biblioteca pesquisar\``,
`\`/biblioteca ver\``,
`\`/biblioteca instalar\``,
`\`/biblioteca publicar\``,
`\`/biblioteca atualizar\``,
`\`/biblioteca editar\``,
`\`/biblioteca apagar\``,
`\`/biblioteca minhas\``,
`\`/biblioteca perfil\``,
`\`/biblioteca destaques\``,
``,
`> ${e.curtida} Crie, publique e compartilhe seus sistemas com a comunidade!`
].join("\n"),
          color: COR
        }
      },

      aventureiro: {
        embed: {
          title: `🏆 Rank de Aventureiro ${e.festa}`,
          description:
[
`\`/rank-de-aventureiro ver\``,
`\`/rank-de-aventureiro placar\``,
``,
`> ${e.corao} Converse no servidor e suba de rank — vai, eu acredito em você~!`
].join("\n"),
          color: COR
        }
      },

      premium: {
        embed: {
          title: `⭐ Premium ${e.carinho}`,
          description:
[
`\`/premium visualizar\` — *Veja seus benefícios*`,
`\`/premium comprar\` — *Adquira o Premium*`,
`\`/premium resgatar\` — *Use uma key*`,
``,
`> ${e.corao} Apoie a Ayami e ganhe vantagens exclusivas — muito obrigada~! ${e.chorando2}`
].join("\n"),
          color: COR
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

            await render(selectInteraction, value);
          },

          data: {
            placeholder: "✨ Escolha uma categoria~",

            options: [
              {
                label: "Início",
                value: "inicio",
                emoji: { id: "1513904597649981561" }, // feliz
                description: "Visão geral da Ayami"
              },
              {
                label: "Configuração",
                value: "configuracao",
                emoji: { name: "⚙️" },
                description: "Painéis e sistemas do servidor"
              },
              {
                label: "Economia",
                value: "economia",
                emoji: { name: "💎" },
                description: "Primogemas e banners"
              },
              {
                label: "Exploração",
                value: "exploracao",
                emoji: { name: "🗺️" },
                description: "Explore regiões e veja o tempo"
              },
              {
                label: "Missões",
                value: "missoes",
                emoji: { name: "📋" },
                description: "Pessoais, guilda e grupo"
              },
              {
                label: "Utilidades",
                value: "utilidades",
                emoji: { name: "🧩" },
                description: "Ferramentas do dia a dia"
              },
              {
                label: "Criação",
                value: "criacao",
                emoji: { name: "🎨" },
                description: "Embeds, componentes e biblioteca"
              },
              {
                label: "Rank de Aventureiro",
                value: "aventureiro",
                emoji: { name: "🏆" },
                description: "Sistema de progressão"
              },
              {
                label: "Premium",
                value: "premium",
                emoji: { name: "⭐" },
                description: "Benefícios exclusivos"
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
              embeds: [current.embed],

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
