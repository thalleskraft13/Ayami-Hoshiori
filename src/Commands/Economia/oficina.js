'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const Workshop      = require("../../function/Estrelas/Workshop.js");
const { economyContext, respond, respondError, getFocusedOption } = require("../../function/Estrelas/interactionHelpers.js");

module.exports = {
  info: {
    name: 'oficina',
    description: 'Oficina da Ayami'
  },

  data: {
    name: 'oficina',
    description: 'Fabrique itens a partir de recursos do seu inventário',
    name_localizations: { 'en-US': 'workshop', 'en-GB': 'workshop', 'es-ES': 'taller' },
    description_localizations: {
      'en-US': 'Craft items using resources from your inventory',
      'en-GB': 'Craft items using resources from your inventory',
      'es-ES': 'Fabrica objetos con recursos de tu inventario',
    },
    options: [
      {
        type: 1,
        name: 'fabricar',
        description: 'Fabrica um item a partir de uma receita',
        name_localizations: { 'en-US': 'craft', 'en-GB': 'craft', 'es-ES': 'fabricar' },
        options: [
          {
            type: 3,
            name: 'receita',
            description: 'Receita a fabricar',
            required: true,
            autocomplete: true
          },
          {
            type: 4,
            name: 'quantidade',
            description: 'Quantas vezes fabricar (padrão: 1)',
            required: false,
            min_value: 1,
            max_value: 100
          }
        ]
      },
      {
        type: 1,
        name: 'receitas',
        description: 'Mostra as receitas disponíveis na Oficina',
        name_localizations: { 'en-US': 'recipes', 'en-GB': 'recipes', 'es-ES': 'recetas' }
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const opts   = interaction.data.options?.[0]?.options ?? [];
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const getOpt = (name) => opts.find(o => o.name === name)?.value;

    const workshop = new Workshop(userId, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'fabricar':
          return await handleFabricar(interaction, workshop, getOpt('receita'), getOpt('quantidade') ?? 1);
        case 'receitas':
          return await handleReceitas(interaction, workshop);
        default:
          return await respondError(interaction, "Subcomando desconhecido.");
      }
    } catch (err) {
      console.error('[/oficina]', err);
      return await respondError(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.");
    }
  },

  async autocomplete(interaction, client) {
    const focused = getFocusedOption(interaction);
    if (!focused || focused.name !== 'receita') return [];

    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const workshop = new Workshop(userId, economyContext(interaction, client));

    return workshop.autocompleteReceitas(focused.value);
  }
};

function formatarCustos(custoRecursos = {}, custoEstrelas = 0) {
  const partes = Object.entries(custoRecursos).map(([nome, qtd]) => `${qtd} ${nome}`);
  if (custoEstrelas) partes.push(`${custoEstrelas} Estrelas`);
  return partes.length ? partes.join(', ') : "Nenhum";
}

async function handleFabricar(interaction, workshop, receitaId, quantidade) {
  const { receita, quantidadeProduzida } = await workshop.fabricar(receitaId, quantidade);

  const embed = new MessageEmbed()
    .setTitle("Item fabricado")
    .setColor("Gold")
    .setDescription(`Você fabricou **${quantidadeProduzida}x ${receita.nome}**.`)
    .addField("Custo utilizado", formatarCustos(
      Object.fromEntries(Object.entries(receita.custoRecursos ?? {}).map(([n, q]) => [n, q * (quantidade ?? 1)])),
      (receita.custoEstrelas ?? 0) * (quantidade ?? 1)
    ), false);

  return await respond(interaction, embed);
}

async function handleReceitas(interaction, workshop) {
  const receitas = workshop.listarReceitas();

  const linhas = receitas.map(r =>
    `**${r.nome}** — custa ${formatarCustos(r.custoRecursos, r.custoEstrelas)} → produz ${r.resultado.quantidade}x ${r.resultado.itemId}`
  );

  const embed = new MessageEmbed()
    .setTitle("Receitas da Oficina")
    .setColor("Gold")
    .setDescription(linhas.join('\n'))
    .setFooter("Use /oficina fabricar para produzir um item.");

  return await respond(interaction, embed);
}
