'use strict';

const DiscordRequest = require("../DiscordRequest.js");
const MessageEmbed   = require("../Messages/EmbedBuild.js");

function economyContext(interaction, client) {
  return {
    client,
    guildId: interaction.guild_id ?? null,
    actor: interaction.member?.user ?? interaction.user ?? null
  };
}

function respond(interaction, embed) {
  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: {
      type: 4,
      data: {
        embeds: [embed.build ? embed.build() : embed]
      }
    }
  });
}

function respondError(interaction, mensagem) {
  const embed = new MessageEmbed()
    .setTitle("⚠️ Não deu certo")
    .setDescription(mensagem)
    .setColor("Red");

  return respond(interaction, embed);
}

const NOMES_CONQUISTAS = {
  primeira_expedicao: '🧭 Primeira Expedição',
  '100_exploracoes':  '🗺️ 100 Explorações',
  primeiro_jardim:    '🌱 Primeiro Jardim',
};

function formatarConquistas(ids = []) {
  return ids.map(id => NOMES_CONQUISTAS[id] ?? id);
}

module.exports = { economyContext, respond, respondError, formatarConquistas };
