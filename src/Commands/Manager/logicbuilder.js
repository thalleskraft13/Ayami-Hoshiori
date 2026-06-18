'use strict';

const getPerm        = require("../../function/Utils/GetPerm.js");
const DiscordRequest  = require("../../function/DiscordRequest.js");

module.exports = {

  data: {
    name:        "logicbuilder",
    description: "Abre o Logic Builder — crie fluxos e automações do servidor"
  },

  info: {
    perm: ["MANAGE_GUILD"]
  },

  async execute(interaction, client) {

    const perms = await getPerm({
      id:      interaction.member.user.id,
      guildId: interaction.guild_id
    });

    if (!perms || !perms.includes("MANAGE_GUILD")) {
      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              content: "❌ Você precisa da permissão **Gerenciar Servidor** para usar este comando.",
              flags:   64
            }
          }
        }
      );
    }

    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: {
          type: 5,
        }
      }
    );

    return client.logicUI.open(interaction);
  }
};
