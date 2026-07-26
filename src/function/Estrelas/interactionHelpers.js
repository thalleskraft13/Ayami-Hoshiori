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

/**
 * Encontra a option "focused" (a que o usuário está digitando agora) em uma
 * interação de autocomplete, seja ela top-level ou dentro de um subcomando.
 */
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

/**
 * Filtra um catálogo (objeto { id: { nome, emoji, ... } }) pelo texto digitado
 * e retorna no formato de choices do Discord ({ name, value }), até 25 itens.
 */
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

module.exports = { economyContext, respond, respondError, formatarConquistas, getFocusedOption, filtrarCatalogo };
