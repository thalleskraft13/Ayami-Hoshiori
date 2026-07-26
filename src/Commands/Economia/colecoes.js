'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const Collections   = require("../../function/Estrelas/Collections.js");
const { respond, respondError } = require("../../function/Estrelas/interactionHelpers.js");

const CHOICES = [
  { name: 'Todas', value: 'todas' },
  { name: 'Recursos coletados', value: 'recursos' },
  { name: 'Itens fabricados', value: 'itens' },
  { name: 'Receitas aprendidas', value: 'receitas' },
  { name: 'Regiões descobertas', value: 'regioes' },
  { name: 'Companheiros obtidos', value: 'companheiros' },
  { name: 'Criações publicadas', value: 'criacoes' }
];

module.exports = {
  info: {
    name: 'colecoes',
    description: 'Coleções da Ayami'
  },

  data: {
    name: 'colecoes',
    description: 'Veja suas coleções: recursos, itens, receitas, regiões, companheiros e criações',
    name_localizations: { 'en-US': 'collections', 'en-GB': 'collections', 'es-ES': 'colecciones' },
    description_localizations: {
      'en-US': 'View your collections: resources, items, recipes, regions, companions and creations',
      'en-GB': 'View your collections: resources, items, recipes, regions, companions and creations',
      'es-ES': 'Consulta tus colecciones: recursos, objetos, recetas, regiones, compañeros y creaciones',
    },
    options: [
      {
        type: 3,
        name: 'categoria',
        description: 'Filtrar por categoria (padrão: todas)',
        required: false,
        choices: CHOICES
      }
    ]
  },

  async execute(interaction, client) {
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const categoria = interaction.data.options?.find(o => o.name === 'categoria')?.value ?? 'todas';

    try {
      const grupos = await Collections.obter(userId, categoria);

      const embed = new MessageEmbed()
        .setTitle("Suas Coleções")
        .setColor("Aqua");

      for (const grupo of grupos) {
        const progresso = grupo.total ? ` (${grupo.obtidos.length}/${grupo.total})` : ` (${grupo.obtidos.length})`;

        const texto = grupo.obtidos.length
          ? grupo.obtidos.map(o => `• ${o.nome}`).join('\n')
          : 'Nada descoberto ainda.';

        embed.addField(`${grupo.nome}${progresso}`, texto);
      }

      return await respond(interaction, embed);
    } catch (err) {
      console.error('[/colecoes]', err);
      return await respondError(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.");
    }
  }
};
