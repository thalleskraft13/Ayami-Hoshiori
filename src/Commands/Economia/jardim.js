'use strict';

const Garden        = require("../../function/Estrelas/Garden.js");
const SEMENTES       = require("../../function/Estrelas/data/sementes.js");
const { construcoes: CONSTRUCOES, decoracoes: DECORACOES } = require("../../function/Estrelas/data/construcoes.js");
const CV2            = require("../../function/Messages/CV2.js");
const {
  economyContext, respondErrorCV2, replyCV2, updateCV2, formatarConquistas
} = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0x66BB6A;

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
        description: 'Abre o painel interativo do seu jardim',
        name_localizations: { 'en-US': 'view', 'en-GB': 'view', 'es-ES': 'ver' }
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const userId = interaction.member?.user?.id ?? interaction.user?.id;

    const garden = new Garden(userId, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'ver': return await handleVer(interaction, client, garden, userId);
        default:
          return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/jardim]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

async function handleVer(interaction, client, garden, userId) {
  const g = await garden.getOrCreate();
  return replyCV2(interaction, buildPainelJardim(client, userId, garden, g));
}

function plotLinha(plot) {
  if (!plot.sementeId) return `\`#${plot.index}\` — vazio`;
  const semente = SEMENTES[plot.sementeId];
  const pronto = Date.now() >= plot.prontoEm;
  return `\`#${plot.index}\` — ${semente.emoji} ${semente.nome} ${pronto ? '(pronto para colher)' : `— pronto <t:${Math.floor(plot.prontoEm / 1000)}:R>`}`;
}

function buildPainelJardim(client, userId, garden, g) {
  const linhasCanteiros = g.plots.map(plotLinha).join('\n') || 'Nenhum canteiro ainda.';
  const nomesConstrucoes = g.construcoes.map(id => CONSTRUCOES[id]?.nome ?? id).join(', ') || 'Nenhuma';
  const nomesDecoracoes  = g.decoracoes.map(id => DECORACOES[id]?.nome ?? id).join(', ') || 'Nenhuma';

  const plotSelect = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '🌱 Selecione um canteiro',
      options: g.plots.map(p => ({
        label: `Canteiro #${p.index}`,
        value: String(p.index),
        description: p.sementeId ? (SEMENTES[p.sementeId]?.nome ?? p.sementeId) : 'Vazio'
      }))
    },
    funcao: async (si) => {
      const gardenFresca = await garden.getOrCreate();
      const plot = gardenFresca.plots.find(p => p.index === Number(si.data.values[0]));
      return updateCV2(si, buildPainelCanteiro(client, userId, garden, plot));
    }
  });

  const construirOptions = Object.values(CONSTRUCOES).filter(c => !g.construcoes.includes(c.id));
  const decorarOptions   = Object.values(DECORACOES).filter(d => !g.decoracoes.includes(d.id));

  const blocos = [
    CV2.text('🌷 **Seu Jardim**'),
    CV2.separator(),
    CV2.text(`**Canteiros:**\n${linhasCanteiros}`),
    CV2.text(`**Construções:** ${nomesConstrucoes}`),
    CV2.text(`**Decorações:** ${nomesDecoracoes}`),
    CV2.separator(),
    CV2.row(plotSelect)
  ];

  if (construirOptions.length) {
    const construirSelect = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: '🏗️ Construir uma melhoria',
        options: construirOptions.map(c => ({
          label: c.nome,
          value: c.id,
          emoji: { name: c.emoji },
          description: `${c.custoEstrelas ? c.custoEstrelas + ' Estrelas' : 'Grátis'}`
        }))
      },
      funcao: async (si) => {
        try {
          const { construcao } = await garden.construir(si.data.values[0]);
          const novaGarden = await garden.getOrCreate();
          return updateCV2(si, buildConfirmacao(client, userId, garden, `${construcao.emoji} **${construcao.nome}** construído no seu jardim!`, novaGarden));
        } catch (err) {
          return updateCV2(si, CV2.container([
            CV2.text('⚠️ **Não deu certo**'),
            CV2.text(err.message)
          ], { accentColor: 0xE74C3C }));
        }
      }
    });
    blocos.push(CV2.row(construirSelect));
  }

  if (decorarOptions.length) {
    const decorarSelect = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: '🎀 Adicionar decoração',
        options: decorarOptions.map(d => ({
          label: d.nome,
          value: d.id,
          emoji: { name: d.emoji },
          description: `${d.custoEstrelas ? d.custoEstrelas + ' Estrelas' : 'Grátis'}`
        }))
      },
      funcao: async (si) => {
        try {
          const { decoracao } = await garden.decorar(si.data.values[0]);
          const novaGarden = await garden.getOrCreate();
          return updateCV2(si, buildConfirmacao(client, userId, garden, `${decoracao.emoji} **${decoracao.nome}** adicionado ao seu jardim! (+5 reputação)`, novaGarden));
        } catch (err) {
          return updateCV2(si, CV2.container([
            CV2.text('⚠️ **Não deu certo**'),
            CV2.text(err.message)
          ], { accentColor: 0xE74C3C }));
        }
      }
    });
    blocos.push(CV2.row(decorarSelect));
  }

  const fecharBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Fechar', style: 4, emoji: { name: '✖️' } },
    funcao: async (bi) => updateCV2(bi, CV2.container([CV2.text('🌷 Jardim fechado.')], { accentColor: ACCENT }))
  });

  blocos.push(CV2.row(fecharBtn));

  return CV2.container(blocos, { accentColor: ACCENT });
}

function buildConfirmacao(client, userId, garden, mensagem, g) {
  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar ao jardim', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, buildPainelJardim(client, userId, garden, g))
  });

  return CV2.container([
    CV2.text(mensagem),
    CV2.row(voltarBtn)
  ], { accentColor: ACCENT });
}

function buildPainelCanteiro(client, userId, garden, plot) {
  if (!plot.sementeId) {
    const sementeSelect = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: '🌱 Selecione uma semente para plantar',
        options: Object.values(SEMENTES).map(s => ({
          label: s.nome,
          value: s.id,
          emoji: { name: s.emoji },
          description: `Pronta em ${s.tempoMinutos} min`
        }))
      },
      funcao: async (si) => {
        try {
          const { semente } = await garden.plantar(plot.index, si.data.values[0]);
          const g = await garden.getOrCreate();
          return updateCV2(si, buildConfirmacao(client, userId, garden, `${semente.emoji} **${semente.nome}** plantada no canteiro \`#${plot.index}\`. Fica pronta em **${semente.tempoMinutos} minutos**.`, g));
        } catch (err) {
          return updateCV2(si, CV2.container([
            CV2.text('⚠️ **Não deu certo**'),
            CV2.text(err.message)
          ], { accentColor: 0xE74C3C }));
        }
      }
    });

    const voltarBtn = client.interactions.createButton({
      user: userId,
      data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
      funcao: async (bi) => {
        const g = await garden.getOrCreate();
        return updateCV2(bi, buildPainelJardim(client, userId, garden, g));
      }
    });

    return CV2.container([
      CV2.text(`🌱 **Canteiro #${plot.index}** — vazio`),
      CV2.row(sementeSelect),
      CV2.row(voltarBtn)
    ], { accentColor: ACCENT });
  }

  const semente = SEMENTES[plot.sementeId];
  const pronto = Date.now() >= plot.prontoEm;

  const botoes = [];

  if (pronto) {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Colher', style: 3, emoji: { name: '🌾' } },
      funcao: async (bi) => {
        const { semente: sementeColhida, conquistas } = await garden.colher(plot.index);
        const listaColheita = Object.entries(sementeColhida.colheita)
          .map(([nome, qtd]) => `+${qtd} ${nome}`)
          .join('\n');

        const blocos = [
          CV2.text(`${sementeColhida.emoji} **Colhido!**`),
          CV2.text(`**Você recebeu:**\n${listaColheita}`)
        ];

        if (conquistas?.length) {
          blocos.push(CV2.text(`**🏅 Conquistas desbloqueadas:**\n${formatarConquistas(conquistas).join('\n')}`));
        }

        const g = await garden.getOrCreate();
        const voltarBtn = client.interactions.createButton({
          user: userId,
          data: { label: 'Voltar ao jardim', style: 2, emoji: { name: '🔙' } },
          funcao: async (bi2) => updateCV2(bi2, buildPainelJardim(client, userId, garden, g))
        });
        blocos.push(CV2.row(voltarBtn));

        return updateCV2(bi, CV2.container(blocos, { accentColor: ACCENT }));
      }
    }));
  } else {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Atualizar', style: 2, emoji: { name: '🔄' } },
      funcao: async (bi) => {
        const g = await garden.getOrCreate();
        const plotFresco = g.plots.find(p => p.index === plot.index);
        return updateCV2(bi, buildPainelCanteiro(client, userId, garden, plotFresco));
      }
    }));
  }

  botoes.push(client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => {
      const g = await garden.getOrCreate();
      return updateCV2(bi, buildPainelJardim(client, userId, garden, g));
    }
  }));

  return CV2.container([
    CV2.text(`${semente.emoji} **Canteiro #${plot.index}** — ${semente.nome}`),
    CV2.text(pronto ? '✅ Pronto para colher!' : `⏳ Pronto <t:${Math.floor(plot.prontoEm / 1000)}:R>.`),
    CV2.row(...botoes)
  ], { accentColor: pronto ? ACCENT : 0xF5C542 });
}
