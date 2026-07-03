const DiscordRequest = require("../../function/DiscordRequest.js");
const db = require("../../Mongodb/userglobal.js");

module.exports = {
  data: {
    name: "notificações",
    description: "Ative ou Desative as notificações por DM",
    type: 1
  },

  async execute(interaction, client) {

    const authorId = interaction.member.user.id;

    let userdb = await db.findOne({
      userId: authorId
    });

    if (!userdb) {
      userdb = new db({
        userId: authorId,
        dmNotificacoes: true
      });

      await userdb.save();
    }

    
    userdb.dmNotificacoes = !userdb.dmNotificacoes;

    await userdb.save();

    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: {
          type: 4,
          data: {
            content: userdb.dmNotificacoes
              ? "✅ Você ativou suas notificações por DM."
              : "❌ Você desativou suas notificações por DM."
          }
        }
      }
    );

  }
};