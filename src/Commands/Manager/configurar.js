'use strict';

const getPerm         = require("../../function/Utils/GetPerm.js");
const DiscordRequest  = require("../../function/DiscordRequest.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

/* ─────────────────────────────────────────────
   CORES DA AYAMI
   ───────────────────────────────────────────── */
const COLOR = {
  main: 0x7C8FFF,
};

/* ═══════════════════════════════════════════════════════════
   HELPERS COMPONENTS V2
   (mesmo padrão usado em todo o resto do bot)
   ═══════════════════════════════════════════════════════════ */

function cv2Text(content) {
  return { type: 10, content };
}

function cv2Divider(spacing = 1) {
  return { type: 14, divider: true, spacing };
}

/** Section (type 9) com accessory de Thumbnail (type 11) — ícone do servidor. */
function cv2SectionThumb(content, thumbUrl) {
  return {
    type: 9,
    accessory: { type: 11, media: { url: thumbUrl } },
    components: [cv2Text(content)]
  };
}

function cv2Container(blocks, opts = {}) {
  return {
    type:         17,
    accent_color: opts.accentColor ?? COLOR.main,
    spoiler:      opts.spoiler ?? false,
    components:   blocks
  };
}

function cv2Flags(ephemeral = false) {
  return ephemeral ? 32768 | 64 : 32768;
}

function cv2Payload(blocks, opts = {}) {
  return {
    flags:      cv2Flags(opts.ephemeral ?? false),
    components: [cv2Container(blocks, opts)]
  };
}

function row(...components) {
  return { type: 1, components };
}

module.exports = {

  data: {
    name: "configurar",
    description: "Painel de configuração do bot",
    name_localizations: { 'en-US': 'configure', 'en-GB': 'configure', 'es-ES': 'configurar' },
    description_localizations: {
      'en-US': 'Bot configuration panel',
      'en-GB': 'Bot configuration panel',
      'es-ES': 'Panel de configuración del bot',
    }
  },

  info: {
    perm: ["MANAGE_GUILD"]
  },

  async execute(interaction, client) {

    const perms = await getPerm({
      id: interaction.member.user.id,
      guildId: interaction.guild_id,
      client
    });

    if (!perms || !perms.includes("MANAGE_GUILD")) {
      const permCtx = localeCtx(interaction);
      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: cv2Payload([
              cv2Text(client.t("common.no_permission_title", {
                ...permCtx,
                perm: client.t("common.perm_manage_guild", permCtx),
                action: client.t("common.action_use_command", permCtx),
              }))
            ], { accentColor: 0xED4245, ephemeral: true })
          }
        }
      );
    }

    let guildData = {};
    try {
      guildData = await DiscordRequest(`/guilds/${interaction.guild_id}`, { method: "GET" });
    } catch {
      guildData = {};
    }

    const user = interaction.member.user.id;
    const e    = client.emoji;
    const ctx  = localeCtx(interaction, { emoji: e?.animada || '' });

    const configSelect = client.interactions.createSelect({
      user,
      data: {
        placeholder: client.t("configurar.select_placeholder", ctx),
        options: [
          {
            label: client.t("configurar.opt_tickets_label", ctx),
            description: client.t("configurar.opt_tickets_desc", ctx),
            value: "tickets",
            emoji: { name: "🎫" }
          },
          {
            label: client.t("configurar.opt_security_label", ctx),
            description: client.t("configurar.opt_security_desc", ctx),
            value: "verification",
            emoji: { name: "🔍" }
          },
          {
            label: client.t("configurar.opt_logic_label", ctx),
            description: client.t("configurar.opt_logic_desc", ctx),
            value: "logic",
            emoji: { name: "⚡" }
          }
        ]
      },

      funcao: async (i) => {
        const value = i.data.values?.[0];

        switch (value) {

          case "tickets":
            // O sistema de tickets (index.js) gerencia seu próprio
            // editOriginal/deferUpdate internamente — basta chamar open().
            await client.ticketSystem.deferUpdate(i);
            return client.ticketSystem.open(i);

          case "uid":
            await client.UidManager.deferUpdate(i);
            return client.UidManager.startSetup(i);

          case "leaks":
            await client.GenshinLeaksManager.deferUpdate(i);
            return client.GenshinLeaksManager.startSetup(i);

          case "birthday":
            return client.giveaway.startMenu(interaction);

          case "verification":
            await client.security.deferUpdate(i);
            return client.security.startSetup(i);

          case "logic":
            if (client.logicUI.ui?.deferUpdate) {
              await client.logicUI.ui.deferUpdate(i);
            } else {
              await client.ticketSystem.deferUpdate(i);
            }
            return client.logicUI.open(i);
        }
      }
    });

    const thumbUrl = guildData.icon
      ? `https://cdn.discordapp.com/icons/${interaction.guild_id}/${guildData.icon}.png?size=1024`
      : null;

    const headerText = client.t("configurar.header", ctx);

    const blocks = [
      thumbUrl ? cv2SectionThumb(headerText, thumbUrl) : cv2Text(headerText),
      cv2Divider(),
      cv2Text(client.t("configurar.body", ctx)),
      cv2Divider(),
      row(configSelect),
      cv2Divider(),
      cv2Text(`-# ${guildData.name || client.t("configurar.fallback_guild_name", { ...ctx, guildId: interaction.guild_id })}`),
    ];

    return DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: {
          type: 4,
          data: cv2Payload(blocks, { accentColor: COLOR.main, ephemeral: false })
        }
      }
    );
  }
};
