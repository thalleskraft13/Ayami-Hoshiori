'use strict';

const Workshop      = require("../../function/Estrelas/Workshop.js");
const UserGlobalDb   = require("../../Mongodb/userglobal.js");
const RECURSOS       = require("../../function/Estrelas/data/recursos.js");
const CV2            = require("../../function/Messages/CV2.js");
const {
  economyContext, respondErrorCV2, replyCV2, updateCV2, getFocusedOption
} = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0xB0BEC5;

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
        name: 'receitas',
        description: 'Abre o painel interativo de receitas da Oficina',
        name_localizations: { 'en-US': 'recipes', 'en-GB': 'recipes', 'es-ES': 'recetas' }
      },
      {
        type: 1,
        name: 'fabricar',
        description: 'Fabrica um item diretamente por uma receita conhecida',
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
        case 'receitas': return await handleReceitas(interaction, client, workshop, userId);
        case 'fabricar':  return await handleFabricar(interaction, client, workshop, userId, getOpt('receita'), getOpt('quantidade') ?? 1);
        default:
          return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/oficina]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
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

async function getRecursosUsuario(userId) {
  const user = await UserGlobalDb.findOne({ userId });
  const mapa = user?.recursos instanceof Map ? Object.fromEntries(user.recursos) : (user?.recursos ?? {});
  return mapa;
}

function formatarCusto(recurso, necessario, disponivel) {
  const nome = RECURSOS[recurso]?.nome ?? recurso;
  const emoji = RECURSOS[recurso]?.emoji ?? '📦';
  const ok = disponivel >= necessario;
  return `${ok ? '✅' : '❌'} ${emoji} ${nome}: \`${disponivel}/${necessario}\``;
}

function buildPainelReceitas(client, userId, workshop) {
  const receitas = workshop.listarReceitas();

  const receitaSelect = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '🛠️ Selecione uma receita',
      options: receitas.map(r => ({
        label: r.nome,
        value: r.id,
        description: `Produz ${r.resultado.quantidade}x`
      }))
    },
    funcao: async (si) => {
      const recursos = await getRecursosUsuario(userId);
      return updateCV2(si, buildDetalheReceita(client, userId, workshop, workshop.obterReceita(si.data.values[0]), recursos));
    }
  });

  return CV2.container([
    CV2.text('🛠️ **Receitas da Oficina**'),
    CV2.separator(),
    CV2.text(receitas.map(r => `**${r.nome}** — produz ${r.resultado.quantidade}x`).join('\n')),
    CV2.separator(),
    CV2.row(receitaSelect)
  ], { accentColor: ACCENT });
}

function buildDetalheReceita(client, userId, workshop, receita, recursos) {
  const custos = Object.entries(receita.custoRecursos ?? {})
    .map(([r, qtd]) => formatarCusto(r, qtd, recursos[r] ?? 0))
    .join('\n') || 'Nenhum recurso necessário';

  const podeFabricar = Object.entries(receita.custoRecursos ?? {})
    .every(([r, qtd]) => (recursos[r] ?? 0) >= qtd);

  const blocos = [
    CV2.text(`🛠️ **${receita.nome}**`),
    CV2.separator(),
    CV2.text(`**Materiais necessários:**\n${custos}`),
    CV2.text(`**Custo em Estrelas:** ${receita.custoEstrelas || 'Nenhum'}`),
    CV2.text(`**Resultado:** ${receita.resultado.quantidade}x ${receita.nome}`),
    CV2.separator()
  ];

  const botoes = [];

  if (podeFabricar) {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Fabricar 1x', style: 3, emoji: { name: '🛠️' } },
      funcao: async (bi) => {
        try {
          const { quantidadeProduzida } = await workshop.fabricar(receita.id, 1);
          const novosRecursos = await getRecursosUsuario(userId);

          const voltarBtn = client.interactions.createButton({
            user: userId,
            data: { label: 'Voltar às receitas', style: 2, emoji: { name: '🔙' } },
            funcao: async (bi2) => updateCV2(bi2, buildPainelReceitas(client, userId, workshop))
          });

          return updateCV2(bi, CV2.container([
            CV2.text(`✅ **Fabricado!**`),
            CV2.text(`Você fabricou **${quantidadeProduzida}x ${receita.nome}**.`),
            CV2.row(voltarBtn)
          ], { accentColor: 0x4CAF50 }));
        } catch (err) {
          return updateCV2(bi, CV2.container([
            CV2.text('⚠️ **Não deu certo**'),
            CV2.text(err.message)
          ], { accentColor: 0xE74C3C }));
        }
      }
    }));
  }

  botoes.push(client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, buildPainelReceitas(client, userId, workshop))
  }));

  blocos.push(CV2.row(...botoes));

  return CV2.container(blocos, { accentColor: podeFabricar ? ACCENT : 0xE0A45D });
}

async function handleReceitas(interaction, client, workshop, userId) {
  return replyCV2(interaction, buildPainelReceitas(client, userId, workshop));
}

async function handleFabricar(interaction, client, workshop, userId, receitaId, quantidade) {
  const { receita, quantidadeProduzida } = await workshop.fabricar(receitaId, quantidade);

  const custoRecursosTotal = Object.entries(receita.custoRecursos ?? {})
    .map(([r, qtd]) => `${qtd * quantidade} ${RECURSOS[r]?.nome ?? r}`)
    .join(', ') || 'Nenhum';

  return replyCV2(interaction, CV2.container([
    CV2.text('🛠️ **Item fabricado**'),
    CV2.text(`Você fabricou **${quantidadeProduzida}x ${receita.nome}**.`),
    CV2.text(`**Custo utilizado:** ${custoRecursosTotal}${receita.custoEstrelas ? `, ${receita.custoEstrelas * quantidade} Estrelas` : ''}`)
  ], { accentColor: 0x4CAF50 }));
}
