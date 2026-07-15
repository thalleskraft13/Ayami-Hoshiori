'use strict';

const getPerm        = require("../../function/Utils/GetPerm.js");
const DiscordRequest  = require("../../function/DiscordRequest.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

module.exports = {

  data: {
    name:        "logicbuilder",
    description: "Abre o Logic Builder — crie fluxos e automações do servidor",
    name_localizations: { 'en-US': 'logicbuilder', 'en-GB': 'logicbuilder', 'es-ES': 'logicbuilder' },
    description_localizations: {
      'en-US': 'Opens the Logic Builder — create server flows and automations',
      'en-GB': 'Opens the Logic Builder — create server flows and automations',
      'es-ES': 'Abre el Logic Builder — crea flujos y automatizaciones del servidor',
    }
  },

  info: {
    perm: ["MANAGE_GUILD"]
  },

  async execute(interaction, client) {

    const perms = await getPerm({
      id:      interaction.member.user.id,
      guildId: interaction.guild_id,
      client
    });

    if (!perms || !perms.includes("MANAGE_GUILD")) {
      const ctx = localeCtx(interaction);
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
                action: client.t("common.action_use_command", ctx),
              }),
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
