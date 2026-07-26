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

function defer(interaction) {
  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: { type: 5, data: {} }
  }).then(() => { interaction.__deferred = true; });
}

function respond(interaction, embed, client) {
  const data = { embeds: [embed.build ? embed.build() : embed] };

  if (interaction.__deferred && client) {
    return DiscordRequest(`/webhooks/${client.clientId}/${interaction.token}/messages/@original`, {
      method: "PATCH",
      body: data
    });
  }

  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: { type: 4, data }
  });
}

function respondError(interaction, mensagem, client) {
  const embed = new MessageEmbed()
    .setTitle("⚠️ Não deu certo")
    .setDescription(mensagem)
    .setColor("Red");

  return respond(interaction, embed, client);
}

const NOMES_CONQUISTAS = {
  primeira_expedicao: '🧭 Primeira Expedição',
  '100_exploracoes':  '🗺️ 100 Explorações',
  primeiro_jardim:    '🌱 Primeiro Jardim',
};

function formatarConquistas(ids = []) {
  return ids.map(id => NOMES_CONQUISTAS[id] ?? id);
}

function getFocusedOption(interaction) {
  const opts = interaction.data.options ?? [];

  for (const opt of opts) {
    if (opt.focused) return opt;
    if (Array.isArray(opt.options)) {
      const nested = opt.options.find(o => o.focused);
      if (nested) return nested;
    }
  }

  return null;
}

function filtrarCatalogo(catalogo, textoDigitado = '') {
  const busca = textoDigitado.toLowerCase();

  return Object.values(catalogo)
    .filter(item => item.nome.toLowerCase().includes(busca))
    .slice(0, 25)
    .map(item => ({
      name: item.nome,
      value: item.id
    }));
}

module.exports = { economyContext, defer, respond, respondError, formatarConquistas, getFocusedOption, filtrarCatalogo };
