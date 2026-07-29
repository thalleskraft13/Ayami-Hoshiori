'use strict';

const Collections    = require("../../function/Estrelas/Collections.js");
const CV2            = require("../../function/Messages/CV2.js");
const { respondErrorCV2, replyCV2, updateCV2 } = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0x26C6DA;

const CATEGORIAS = [
  { label: 'Todas', value: 'todas', emoji: '📚' },
  { label: 'Recursos coletados', value: 'recursos', emoji: '🪵' },
  { label: 'Itens fabricados', value: 'itens', emoji: '🛠️' },
  { label: 'Receitas aprendidas', value: 'receitas', emoji: '📜' },
  { label: 'Regiões descobertas', value: 'regioes', emoji: '🗺️' },
  { label: 'Companheiros obtidos', value: 'companheiros', emoji: '🐾' },
  { label: 'Criações publicadas', value: 'criacoes', emoji: '🎨' }
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
    options: []
  },

  async execute(interaction, client) {
    const userId = interaction.member?.user?.id ?? interaction.user?.id;

    try {
      return await replyCV2(interaction, await buildPainelColecoes(client, userId, 'todas'));
    } catch (err) {
      console.error('[/colecoes]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

async function buildPainelColecoes(client, userId, categoriaFiltro) {
  const grupos = await Collections.obter(userId, categoriaFiltro);

  const blocos = [CV2.text('📚 **Suas Coleções**'), CV2.separator()];

  for (const grupo of grupos) {
    const progresso = grupo.total ? ` (${grupo.obtidos.length}/${grupo.total})` : ` (${grupo.obtidos.length})`;
    const texto = grupo.obtidos.length
      ? grupo.obtidos.map(o => `• ${o.nome}`).join('\n')
      : 'Nada descoberto ainda.';

    blocos.push(CV2.text(`**${grupo.nome}${progresso}**\n${texto}`));
  }

  blocos.push(CV2.separator());

  const select = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '📂 Filtrar por categoria',
      options: CATEGORIAS.map(c => ({ label: c.label, value: c.value, emoji: { name: c.emoji } }))
    },
    funcao: async (si) => updateCV2(si, await buildPainelColecoes(client, userId, si.data.values[0]))
  });

  blocos.push(CV2.row(select));

  return CV2.container(blocos, { accentColor: ACCENT });
}
