'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const Garden        = require("../../function/Estrelas/Garden.js");
const SEMENTES      = require("../../function/Estrelas/data/sementes.js");
const { construcoes: CONSTRUCOES, decoracoes: DECORACOES } = require("../../function/Estrelas/data/construcoes.js");
const { economyContext, respond, respondError, formatarConquistas } = require("../../function/Estrelas/interactionHelpers.js");

module.exports = {
  info: {
    name: 'jardim',
    description: 'Jardim da Ayami'
  },

  data: {
    name: 'jardim',
    description: 'Plante, colha, construa e decore seu jardim',
    name_localizations: { 'en-US': 'garden', 'en-GB': 'garden', 'es-ES': 'jardin' },
    description_localizations: {
      'en-US': 'Plant, harvest, build and decorate your garden',
      'en-GB': 'Plant, harvest, build and decorate your garden',
      'es-ES': 'Planta, cosecha, construye y decora tu jardín',
    },
    options: [
      {
        type: 1,
        name: 'ver',
        description: 'Mostra o estado do seu jardim',
        name_localizations: { 'en-US': 'view', 'en-GB': 'view', 'es-ES': 'ver' }
      },
      {
        type: 1,
        name: 'plantar',
        description: 'Planta uma semente em um canteiro',
        name_localizations: { 'en-US': 'plant', 'en-GB': 'plant', 'es-ES': 'plantar' },
        options: [
          {
            type: 4,
            name: 'canteiro',
            description: 'Número do canteiro (veja com /jardim ver)',
            required: true,
            min_value: 0
          },
          {
            type: 3,
            name: 'semente',
            description: 'Semente a plantar',
            required: true,
            choices: [
              { name: '🌸 Flor Estelar',    value: 'flor_estelar' },
              { name: '🍄 Cogumelo Lunar',  value: 'cogumelo_lunar' },
              { name: '🌱 Arvorezinha',     value: 'arvore_pequena' },
              { name: '💎 Broto de Cristal', value: 'cristal_bruto' },
            ]
          }
        ]
      },
      {
        type: 1,
        name: 'colher',
        description: 'Colhe um canteiro pronto',
        name_localizations: { 'en-US': 'harvest', 'en-GB': 'harvest', 'es-ES': 'cosechar' },
        options: [
          {
            type: 4,
            name: 'canteiro',
            description: 'Número do canteiro a colher',
            required: true,
            min_value: 0
          }
        ]
      },
      {
        type: 1,
        name: 'construir',
        description: 'Constrói uma melhoria no seu jardim',
        name_localizations: { 'en-US': 'build', 'en-GB': 'build', 'es-ES': 'construir' },
        options: [
          {
            type: 3,
            name: 'construcao',
            description: 'O que construir',
            required: true,
            choices: [
              { name: '🪴 Canteiro Extra',    value: 'canteiro_extra' },
              { name: '🪵 Cerca Decorativa',  value: 'cerca_decorativa' },
            ]
          }
        ]
      },
      {
        type: 1,
        name: 'decorar',
        description: 'Adiciona uma decoração ao seu jardim',
        name_localizations: { 'en-US': 'decorate', 'en-GB': 'decorate', 'es-ES': 'decorar' },
        options: [
          {
            type: 3,
            name: 'decoracao',
            description: 'O que adicionar',
            required: true,
            choices: [
              { name: '🏮 Lanterna Estelar', value: 'lanterna_estelar' },
              { name: '🪨 Banco de Pedra',   value: 'banco_de_pedra' },
            ]
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

    const garden = new Garden(userId, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'ver':       return await handleVer(interaction, garden);
        case 'plantar':   return await handlePlantar(interaction, garden, getOpt('canteiro'), getOpt('semente'));
        case 'colher':    return await handleColher(interaction, garden, getOpt('canteiro'));
        case 'construir': return await handleConstruir(interaction, garden, getOpt('construcao'));
        case 'decorar':   return await handleDecorar(interaction, garden, getOpt('decoracao'));
        default:
          return await respondError(interaction, "Subcomando desconhecido.");
      }
    } catch (err) {
      console.error('[/jardim]', err);
      return await respondError(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.");
    }
  }
};

async function handleVer(interaction, garden) {
  const g = await garden.getOrCreate();

  const linhasCanteiros = g.plots.map(p => {
    if (!p.sementeId) return `\`#${p.index}\` — vazio`;
    const semente = SEMENTES[p.sementeId];
    const pronto = Date.now() >= p.prontoEm;
    return `\`#${p.index}\` — ${semente.emoji} ${semente.nome} ${pronto ? "✅ pronto!" : `⏳ <t:${Math.floor(p.prontoEm / 1000)}:R>`}`;
  });

  const embed = new MessageEmbed()
    .setTitle("🌿 Seu Jardim")
    .setColor("Green")
    .addField("Canteiros", linhasCanteiros.join('\n') || "Nenhum", false)
    .addField("Construções", g.construcoes.length ? g.construcoes.join(', ') : "Nenhuma", true)
    .addField("Decorações", g.decoracoes.length ? g.decoracoes.join(', ') : "Nenhuma", true);

  return await respond(interaction, embed);
}

async function handlePlantar(interaction, garden, canteiro, sementeId) {
  const { semente } = await garden.plantar(canteiro, sementeId);

  const embed = new MessageEmbed()
    .setTitle(`${semente.emoji} Plantado!`)
    .setColor("Green")
    .setDescription(`**${semente.nome}** plantada no canteiro \`#${canteiro}\`. Fica pronta em **${semente.tempoMinutos} minutos**.`);

  return await respond(interaction, embed);
}

async function handleColher(interaction, garden, canteiro) {
  const { semente, conquistas } = await garden.colher(canteiro);

  const listaColheita = Object.entries(semente.colheita)
    .map(([nome, qtd]) => `\`+${qtd}\` ${nome}`)
    .join('\n');

  const embed = new MessageEmbed()
    .setTitle(`${semente.emoji} Colhido!`)
    .setColor("Green")
    .addField("Você recebeu", listaColheita, false);

  if (conquistas?.length) {
    embed.addField("🏅 Conquistas desbloqueadas", formatarConquistas(conquistas).join('\n'), false);
  }

  return await respond(interaction, embed);
}

async function handleConstruir(interaction, garden, construcaoId) {
  const { construcao } = await garden.construir(construcaoId);

  const embed = new MessageEmbed()
    .setTitle(`${construcao.emoji} Construído!`)
    .setColor("Green")
    .setDescription(`**${construcao.nome}** adicionado ao seu jardim.`);

  return await respond(interaction, embed);
}

async function handleDecorar(interaction, garden, decoracaoId) {
  const { decoracao } = await garden.decorar(decoracaoId);

  const embed = new MessageEmbed()
    .setTitle(`${decoracao.emoji} Decorado!`)
    .setColor("Green")
    .setDescription(`**${decoracao.nome}** adicionado ao seu jardim. (+5 reputação)`);

  return await respond(interaction, embed);
}
