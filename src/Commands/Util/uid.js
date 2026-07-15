'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");
const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const { localeCtx } = require("../../function/Utils/ctxLocale.js");

module.exports = {
  data: {
    name: "uid",
    description: "Comandos relacionados a Uid",
    name_localizations: { 'en-US': 'uid', 'en-GB': 'uid', 'es-ES': 'uid' },
    description_localizations: {
      'en-US': 'Commands related to UID',
      'en-GB': 'Commands related to UID',
      'es-ES': 'Comandos relacionados con el UID',
    },
    type: 1,
    options: [{
      name: "salvar",
      description: "Salve seu Uid para todos visualizar",
      type: 1,
      options: [{
        name: "uid",
        description: "Insira seu Uid do jogo",
        type: 10,
        max_length: 15,
        min_length: 7,
        required: true
      },{
        name: "servidor",
        description: "Coloque qual servidor você usa",
        type: 3,
        required: true,
        choices: [{
          name: "America Server",
          value: "1"
        },{
          name: "Europa Server",
          value: "2"
        },{
          name: "Asia Server",
          value: "3"
        }]
      }]
    },{
      name: "ver",
      description: "Veja o Uid de algum membro",
      type: 1,
      options: [{
        name: "usuario",
        description: "Mencione ou insira o ID do usuario",
        type: 6,
        required: true
      }]
    }]
  },

  async execute(interaction, client) {

    const subcommand = interaction.data.options[0];
    const authorId = interaction.member.user.id;
    const emoji = client.emoji;

    const servidores = {
      "1": "America Server",
      "2": "Europa Server",
      "3": "Asia Server"
    };

    // ──────────────────────────────────────────
    //  SALVAR
    // ──────────────────────────────────────────
    if (subcommand.name === "salvar") {

      const uid = subcommand.options?.[0]?.value;
      const server = subcommand.options?.[1]?.value;

      let userdb = await db.findOne({ userId: authorId });

      if (!userdb) {
        const newuser = new db({ userId: authorId });
        await newuser.save();
        userdb = await db.findOne({ userId: authorId });
      }

      userdb.uidGenshin = uid;
      userdb.server = servidores[server];
      await userdb.save();

      const ctx = localeCtx(interaction, {
        eAnimada: emoji.animada,
        eCorao: emoji.corao,
        uid,
        servidor: servidores[server],
      });

      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              content: client.t("uid.saved", ctx)
            }
          }
        }
      );
      
      await client.UidManager.checkAndSendUid({
        guildId: interaction.guild_id,
        uid,
        server: servidores[server],
        user: interaction.member.user
      });
    }

    // ──────────────────────────────────────────
    //  VER
    // ──────────────────────────────────────────
    if (subcommand.name === "ver") {

      const userID = subcommand.options?.[0]?.value;

      let userdb = await db.findOne({ userId: userID });

      if (!userdb) {
        const newuser = new db({ userId: userID });
        await newuser.save();
        userdb = await db.findOne({ userId: userID });
      }

      const user = await DiscordRequest(`/users/${userID}`, { method: "GET" });
      const userName = user.global_name || user.username;
      const userUrl = `https://discord.com/users/${userID}`;

      // ── Sem UID ──
      if (!userdb.uidGenshin || userdb.uidGenshin === 0) {

        const ctxNotFound = localeCtx(interaction, {
          eEmduvida: emoji.emduvida,
          eEmburrada: emoji.emburrada,
          userName,
          userUrl,
        });

        const embed = new MessageEmbed()
          .setTitle(client.t("uid.not_found_title", ctxNotFound))
          .setDescription(client.t("uid.not_found_desc", ctxNotFound))
          .setColor("Red")
          .build();

        return DiscordRequest(
          `/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: "POST",
            body: {
              type: 4,
              data: {
                content: `<@${authorId}>`,
                embeds: [embed]
              }
            }
          }
        );
      }

      // ── Com UID ──
      const ctxFound = localeCtx(interaction, {
        eFeliz: emoji.feliz,
        eCurtida: emoji.curtida,
        eAnimada: emoji.animada,
        userName,
        userUrl,
        uid: userdb.uidGenshin,
        servidor: userdb.server,
      });

      const embed = new MessageEmbed()
        .setTitle(client.t("uid.found_title", ctxFound))
        .setDescription(client.t("uid.found_desc", ctxFound))
        .setColor("Blue")
        .setThumbnail(getAvatarURL(user))
        .build();

      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              content: `<@${authorId}>`,
              embeds: [embed]
            }
          }
        }
      );
    }
  }
};

function getAvatarURL(user) {
  if (!user.avatar)
    return `https://cdn.discordapp.com/embed/avatars/0.png`;

  const isGif = user.avatar.startsWith("a_");
  const ext = isGif ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=1024`;
}