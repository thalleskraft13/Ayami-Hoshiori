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
      name_localizations: { 'en-US': "save", 'en-GB': "save", 'es-ES': "guardar" },
      description: "Salve seu Uid para todos visualizar",
      description_localizations: { 'en-US': "Save your UID for everyone to see", 'en-GB': "Save your UID for everyone to see", 'es-ES': "Guarda tu UID para que todos lo vean" },
      type: 1,
      options: [{
        name: "uid",
        name_localizations: { 'en-US': "uid", 'en-GB': "uid", 'es-ES': "uid" },
        description: "Insira seu Uid do jogo",
        description_localizations: { 'en-US': "Enter your in-game UID", 'en-GB': "Enter your in-game UID", 'es-ES': "Ingresa tu UID del juego" },
        type: 10,
        max_length: 15,
        min_length: 7,
        required: true
      },{
        name: "servidor",
        name_localizations: { 'en-US': "server", 'en-GB': "server", 'es-ES': "servidor" },
        description: "Coloque qual servidor você usa",
        description_localizations: { 'en-US': "Enter which server you play on", 'en-GB': "Enter which server you play on", 'es-ES': "Indica que servidor usas" },
        type: 3,
        required: true,
        choices: [{
          name: "America Server",
          name_localizations: { 'en-US': "America Server", 'en-GB': "America Server", 'es-ES': "Servidor America" },
          value: "1"
        },{
          name: "Europa Server",
          name_localizations: { 'en-US': "Europe Server", 'en-GB': "Europe Server", 'es-ES': "Servidor Europa" },
          value: "2"
        },{
          name: "Asia Server",
          name_localizations: { 'en-US': "Asia Server", 'en-GB': "Asia Server", 'es-ES': "Servidor Asia" },
          value: "3"
        }]
      }]
    },{
      name: "ver",
      name_localizations: { 'en-US': "view", 'en-GB': "view", 'es-ES': "ver" },
      description: "Veja o Uid de algum membro",
      description_localizations: { 'en-US': "See a member's UID", 'en-GB': "See a member's UID", 'es-ES': "Consulta el UID de algun miembro" },
      type: 1,
      options: [{
        name: "usuario",
        name_localizations: { 'en-US': "user", 'en-GB': "user", 'es-ES': "usuario" },
        description: "Mencione ou insira o ID do usuario",
        description_localizations: { 'en-US': "Mention or enter the user's ID", 'en-GB': "Mention or enter the user's ID", 'es-ES': "Menciona o ingresa el ID del usuario" },
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