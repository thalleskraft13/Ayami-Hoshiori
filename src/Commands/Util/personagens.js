const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");

module.exports = {
  info: {
    name: 'personagens',
    description: 'Mostra seus personagens'
  },

  data: {
    name: 'personagens',
    description: 'Mostra seus personagens obtidos',
    type: 1
  },

  async execute(interaction, client) {

    await DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      method: "POST",
      body: { type: 5 }
    });

    const userId = interaction.member.user.id;

    let userData = await UserGlobalDb.findOne({ userId });

    if (!userData) {
      userData = await UserGlobalDb.create({ userId });
    }

    if (!userData.personagens || userData.personagens.length === 0) {
      return await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
        method: "POST",
        body: {
          content: "Você ainda não possui personagens."
        }
      });
    }

    const fiveStars = userData.personagens
      .filter(p => p.raridade == 5)
      .sort((a, b) => a.nome.localeCompare(b.nome));

    const fourStars = userData.personagens
      .filter(p => p.raridade == 4)
      .sort((a, b) => a.nome.localeCompare(b.nome));

    let description = "";

    if (fiveStars.length > 0) {
      description += "🌟 **5 Estrelas**\n";
      fiveStars.forEach(p => {
        description += `• ${p.nome} (C${p.constelacao})\n`;
      });
      description += "\n";
    }

    if (fourStars.length > 0) {
      description += "⭐ **4 Estrelas**\n";
      fourStars.forEach(p => {
        description += `• ${p.nome} (C${p.constelacao})\n`;
      });
    }

    const embed = new MessageEmbed()
      .setTitle("🎒 Seus Personagens")
      .setDescription(description)
      .randomColor()
      .build();

    await DiscordRequest(`/webhooks/${interaction.application_id}/${interaction.token}`, {
      method: "POST",
      body: {
        embeds: [embed]
      }
    });

  }
};