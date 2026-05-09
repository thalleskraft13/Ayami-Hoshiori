const getPerm = require("../../function/Utils/GetPerm.js");
const DiscordRequest = require("../../function/DiscordRequest.js");

module.exports = {

  data: {
    name: "configurar",
    description: "Painel de configuração do bot"
  },

  info: {
    perm: ["MANAGE_GUILD"]
  },

  async execute(interaction, client) {

    const perms = await getPerm({
      id: interaction.member.user.id,
      guildId: interaction.guild_id
    });

    if (!perms || !perms.includes("MANAGE_GUILD")) {

      await DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              content:
                "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",
              flags: 64
            }
          }
        }
      );

      return;
    }

   

    let guildData = {};

    try {
      guildData = await DiscordRequest(
        `/guilds/${interaction.guild_id}`,
        {
          method: "GET"
        }
      );
    } catch {
      guildData = {};
    }

    const user = interaction.member.user.id;


    const ticketBtn = client.interactions.createButton({
      user,

      data: {
        label: "Sistema de Tickets",
        emoji: {
          name: "🎫"
        },
        style: 1
      },

      funcao: async (i) => {

        await client.ticketSystem.deferUpdate(i);

        return client.ticketSystem.startSetup(i);
      }
    });

    

    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",

        body: {
          type: 4,

          data: {

            embeds: [
              {
                title: "⚙️ Central de Configuração",

                description:
                  [
                    "Bem-vindo ao painel principal de configuração.",
                    "",
                    "> Escolha um sistema abaixo para começar.",
                    "",
                    "🎫 **Sistema de Tickets**",
                    "Configure painéis, categorias, staff, modais e automações.",
                    "",
                    "✨ **Sistema de House**",
                    "Configure recepção,salve personagens pra facilitar buscas,mensagens e etc.\n-# Ainda em desenvolvimento."
                  ].join("\n"),

                color: 0x2b2d31,

                thumbnail: guildData.icon
                  ? {
                      url:
                        `https://cdn.discordapp.com/icons/` +
                        `${interaction.guild_id}/` +
                        `${guildData.icon}.png?size=1024`
                    }
                  : undefined,

                footer: {
                  text:
                    guildData.name ||
                    `Servidor ${interaction.guild_id}`
                }
              }
            ],

            components: [
              {
                type: 1,
                components: [
                  ticketBtn,
                  {
  type: 2,
  style: 1,
  label: "House Sistema",
  custom_id: "x",
  disabled: true
}
                ]
              }
            ]
          }
        }
      }
    );
  }
};