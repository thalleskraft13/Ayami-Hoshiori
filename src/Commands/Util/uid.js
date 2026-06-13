'use strict';

const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");
const MessageEmbed = require("../../function/Messages/EmbedBuild.js");

module.exports = {
  data: {
    name: "uid",
    description: "Comandos relacionados a Uid",
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

      

      return DiscordRequest(
        `/interactions/${interaction.id}/${interaction.token}/callback`,
        {
          method: "POST",
          body: {
            type: 4,
            data: {
              content: `${emoji.animada} UID salvo com sucesso! Agora todo mundo pode te encontrar no jogo~\n**${uid}** \`(${servidores[server]})\` ${emoji.corao}`
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

      // ── Sem UID ──
      if (!userdb.uidGenshin || userdb.uidGenshin === 0) {

        const embed = new MessageEmbed()
          .setTitle(`${emoji.emduvida} UID não encontrado...`)
          .setDescription(`${emoji.emburrada} [${userName}](https://discord.com/users/${userID}) ainda não salvou nenhum UID...\n\nUse \`/uid salvar\` pra registrar o seu!`)
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
      const embed = new MessageEmbed()
        .setTitle(`${emoji.feliz} UID de ${userName}`)
        .setDescription(`${emoji.curtida} O UID de [${userName}](https://discord.com/users/${userID}) é **${userdb.uidGenshin}** \`(${userdb.server})\`!\n\nVá lá e adiciona ele no jogo~ ${emoji.animada}`)
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