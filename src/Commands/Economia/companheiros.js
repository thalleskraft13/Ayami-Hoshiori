'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const Companion     = require("../../function/Estrelas/Companion.js");
const CATALOGO      = require("../../function/Estrelas/data/companheiros.js");
const { economyContext, respond, respondError, getFocusedOption } = require("../../function/Estrelas/interactionHelpers.js");

module.exports = {
  info: {
    name: 'companheiros',
    description: 'Companheiros da Ayami'
  },

  data: {
    name: 'companheiros',
    description: 'Veja, ative, alimente e evolua seus companheiros',
    name_localizations: { 'en-US': 'companions', 'en-GB': 'companions', 'es-ES': 'companeros' },
    description_localizations: {
      'en-US': 'View, activate, feed and evolve your companions',
      'en-GB': 'View, activate, feed and evolve your companions',
      'es-ES': 'Ve, activa, alimenta y evoluciona tus compañeros',
    },
    options: [
      {
        type: 1,
        name: 'ver',
        description: 'Mostra seus companheiros',
        name_localizations: { 'en-US': 'view', 'en-GB': 'view', 'es-ES': 'ver' }
      },
      {
        type: 1,
        name: 'ativar',
        description: 'Define seu companheiro ativo',
        name_localizations: { 'en-US': 'activate', 'en-GB': 'activate', 'es-ES': 'activar' },
        options: [
          {
            type: 3,
            name: 'companheiro',
            description: 'Qual companheiro ativar',
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        type: 1,
        name: 'alimentar',
        description: 'Alimenta um companheiro (custa 2 Cogumelos)',
        name_localizations: { 'en-US': 'feed', 'en-GB': 'feed', 'es-ES': 'alimentar' },
        options: [
          {
            type: 3,
            name: 'companheiro',
            description: 'Qual companheiro alimentar',
            required: true,
            autocomplete: true
          }
        ]
      },
      {
        type: 1,
        name: 'evoluir',
        description: 'Evolui um companheiro com felicidade máxima',
        name_localizations: { 'en-US': 'evolve', 'en-GB': 'evolve', 'es-ES': 'evolucionar' },
        options: [
          {
            type: 3,
            name: 'companheiro',
            description: 'Qual companheiro evoluir',
            required: true,
            autocomplete: true
          }
        ]
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const opts   = interaction.data.options?.[0]?.options ?? [];
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const getOpt = (name) => opts.find(o => o.name === name)?.value;

    const companion = new Companion(userId, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'ver':       return await handleVer(interaction, companion, userId);
        case 'ativar':    return await handleAtivar(interaction, companion, getOpt('companheiro'));
        case 'alimentar': return await handleAlimentar(interaction, companion, getOpt('companheiro'));
        case 'evoluir':   return await handleEvoluir(interaction, companion, getOpt('companheiro'));
        default:
          return await respondError(interaction, "Subcomando desconhecido.");
      }
    } catch (err) {
      console.error('[/companheiros]', err);
      return await respondError(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.");
    }
  },

  async autocomplete(interaction, client) {
    const focused = getFocusedOption(interaction);
    if (!focused || focused.name !== 'companheiro') return [];

    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const companion = new Companion(userId, economyContext(interaction, client));

    return companion.autocompletePossuidos(focused.value);
  }
};

async function handleVer(interaction, companion, userId) {
  const lista = await companion.listar();

  if (!lista.length) {
    const embed = new MessageEmbed()
      .setTitle("🐾 Seus Companheiros")
      .setColor("Gray")
      .setDescription("Você ainda não tem nenhum companheiro. Explore regiões com `/explorar iniciar` para descobrir um!");

    return await respond(interaction, embed);
  }

  const embed = new MessageEmbed()
    .setTitle("🐾 Seus Companheiros")
    .setColor("Gold");

  for (const c of lista) {
    embed.addField(
      `${c.catalogo?.emoji ?? '🐾'} ${c.catalogo?.nome ?? c.companheiroId}`,
      `Nível **${c.nivel}** • Felicidade **${c.felicidade}/100**`,
      true
    );
  }

  return await respond(interaction, embed);
}

async function handleAtivar(interaction, companion, companheiroId) {
  const catalogo = await companion.ativar(companheiroId);

  const embed = new MessageEmbed()
    .setTitle(`${catalogo.emoji} Companheiro ativado!`)
    .setColor("Green")
    .setDescription(`**${catalogo.nome}** agora vai te acompanhar nas expedições.`);

  return await respond(interaction, embed);
}

async function handleAlimentar(interaction, companion, companheiroId) {
  const atualizado = await companion.alimentar(companheiroId);
  const catalogo = CATALOGO[companheiroId];

  const embed = new MessageEmbed()
    .setTitle(`${catalogo.emoji} Companheiro alimentado!`)
    .setColor("Green")
    .setDescription(`Felicidade de **${catalogo.nome}**: **${atualizado.felicidade}/100**.`);

  return await respond(interaction, embed);
}

async function handleEvoluir(interaction, companion, companheiroId) {
  const atualizado = await companion.evoluir(companheiroId);
  const catalogo = CATALOGO[companheiroId];

  const embed = new MessageEmbed()
    .setTitle(`${catalogo.emoji} Companheiro evoluiu!`)
    .setColor("Gold")
    .setDescription(`**${catalogo.nome}** agora está no nível **${atualizado.nivel}**!`);

  return await respond(interaction, embed);
}
