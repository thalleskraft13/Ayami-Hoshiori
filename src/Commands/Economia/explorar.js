'use strict';

const Exploration  = require("../../function/Estrelas/Exploration.js");
const DURACOES     = require("../../function/Estrelas/data/duracoes.js");
const COMPANHEIROS = require("../../function/Estrelas/data/companheiros.js");
const RECURSOS     = require("../../function/Estrelas/data/recursos.js");
const CV2          = require("../../function/Messages/CV2.js");
const {
  economyContext, defer, respondErrorCV2, editCV2, replyCV2, updateCV2, formatarConquistas
} = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0x4CAF50;

module.exports = {
  info: {
    name: 'explorar',
    description: 'Exploração da Ayami'
  },

  data: {
    name: 'explorar',
    description: 'Explore regiões, envie expedições e colete recompensas',
    name_localizations: { 'en-US': 'explore', 'en-GB': 'explore', 'es-ES': 'explorar' },
    description_localizations: {
      'en-US': 'Explore regions, send expeditions and collect rewards',
      'en-GB': 'Explore regions, send expeditions and collect rewards',
      'es-ES': 'Explora regiones, envía expediciones y recoge recompensas',
    },
    options: [
      {
        type: 1,
        name: 'regioes',
        description: 'Abre o painel interativo de regiões e expedições',
        name_localizations: { 'en-US': 'regions', 'en-GB': 'regions', 'es-ES': 'regiones' }
      },
      {
        type: 1,
        name: 'status',
        description: 'Mostra sua expedição em andamento',
        name_localizations: { 'en-US': 'status', 'en-GB': 'status', 'es-ES': 'estado' }
      },
      {
        type: 1,
        name: 'coletar',
        description: 'Coleta as recompensas da sua expedição concluída',
        name_localizations: { 'en-US': 'collect', 'en-GB': 'collect', 'es-ES': 'recoger' }
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const userId = interaction.member?.user?.id ?? interaction.user?.id;

    const exploration = new Exploration(userId, economyContext(interaction, client));

    if (sub === 'coletar') await defer(interaction);

    try {
      switch (sub) {
        case 'regioes': return await handleRegioes(interaction, client, exploration, userId);
        case 'status':  return await handleStatus(interaction, client, exploration, userId);
        case 'coletar': return await handleColetar(interaction, client, exploration, userId);
        default:
          return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/explorar]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

function regiaoResumo(regiao) {
  const recursosNomes = regiao.recursos.map(r => RECURSOS[r]?.nome ?? r).join(', ');
  return `${regiao.emoji} **${regiao.nome}** — Dificuldade ${'⭐'.repeat(regiao.dificuldade)}\nRecursos: ${recursosNomes}${regiao.companheiro ? '\nPrimeira expedição concluída revela um companheiro!' : ''}`;
}

function buildPainelRegioes(client, userId, exploration) {
  const regioes = exploration.listarRegioes().sort((a, b) => a.dificuldade - b.dificuldade);
  const linhas = regioes.map(regiaoResumo).join('\n\n');

  const regiaoSelect = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '🗺️ Selecione uma região para explorar',
      options: regioes.map(r => ({
        label: r.nome,
        value: r.id,
        emoji: { name: r.emoji },
        description: `Dificuldade ${r.dificuldade} — ${r.recursos.length} recurso(s)`
      }))
    },
    funcao: async (si) => {
      const ativa = await exploration.statusAtual();
      if (ativa) {
        return updateCV2(si, buildPainelStatus(client, userId, exploration, ativa, exploration.getRegiao(ativa.regiaoId)));
      }
      const regiao = exploration.getRegiao(si.data.values[0]);
      return updateCV2(si, buildPainelDuracao(client, userId, exploration, regiao));
    }
  });

  return CV2.container([
    CV2.text('🗺️ **Regiões de Exploração**'),
    CV2.separator(),
    CV2.text(linhas),
    CV2.separator(),
    CV2.row(regiaoSelect)
  ], { accentColor: ACCENT });
}

function buildPainelDuracao(client, userId, exploration, regiao) {
  const duracaoSelect = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '⏱️ Selecione a duração da expedição',
      options: Object.entries(DURACOES).map(([key, d]) => ({
        label: d.label,
        value: key,
        description: `Multiplicador de recompensa x${d.multiplicador}`
      }))
    },
    funcao: async (si) => {
      try {
        const { duracao } = await exploration.iniciar(regiao.id, si.data.values[0]);
        return updateCV2(si, buildConfirmacaoInicio(client, userId, exploration, regiao, duracao));
      } catch (err) {
        return updateCV2(si, CV2.container([
          CV2.text('⚠️ **Não deu certo**'),
          CV2.text(err.message || 'Ocorreu um erro ao iniciar a expedição.')
        ], { accentColor: 0xE74C3C }));
      }
    }
  });

  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, buildPainelRegioes(client, userId, exploration))
  });

  return CV2.container([
    CV2.text(`${regiao.emoji} **${regiao.nome}**`),
    CV2.text('Escolha por quanto tempo seu companheiro vai explorar essa região.'),
    CV2.separator(),
    CV2.row(duracaoSelect),
    CV2.row(voltarBtn)
  ], { accentColor: ACCENT });
}

function buildConfirmacaoInicio(client, userId, exploration, regiao, duracao) {
  const statusBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Ver status', style: 1, emoji: { name: '🧭' } },
    funcao: async (bi) => {
      const ativa = await exploration.statusAtual();
      return updateCV2(bi, buildPainelStatus(client, userId, exploration, ativa, exploration.getRegiao(ativa.regiaoId)));
    }
  });

  return CV2.container([
    CV2.text(`${regiao.emoji} **Expedição iniciada!**`),
    CV2.text(`Sua expedição para **${regiao.nome}** vai durar **${duracao.label}**.`),
    CV2.row(statusBtn)
  ], { accentColor: ACCENT });
}

function buildPainelStatus(client, userId, exploration, ativa, regiao) {
  if (!ativa) {
    const explorarBtn = client.interactions.createButton({
      user: userId,
      data: { label: 'Ver regiões', style: 1, emoji: { name: '🗺️' } },
      funcao: async (bi) => updateCV2(bi, buildPainelRegioes(client, userId, exploration))
    });

    return CV2.container([
      CV2.text('🧭 **Nenhuma expedição em andamento**'),
      CV2.text('Use o botão abaixo para escolher uma região.'),
      CV2.row(explorarBtn)
    ], { accentColor: 0x808080 });
  }

  const pronta = Date.now() >= ativa.finalizaEm;

  const botoes = [];
  if (pronta) {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Coletar recompensas', style: 3, emoji: { name: '🎁' } },
      funcao: async (bi) => {
        const resultado = await exploration.coletar();
        return updateCV2(bi, buildResultadoColeta(client, userId, exploration, resultado));
      }
    }));
  } else {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Atualizar', style: 2, emoji: { name: '🔄' } },
      funcao: async (bi) => {
        const nova = await exploration.statusAtual();
        return updateCV2(bi, buildPainelStatus(client, userId, exploration, nova, exploration.getRegiao(nova.regiaoId)));
      }
    }));
  }

  return CV2.container([
    CV2.text(`${regiao.emoji} **Expedição em ${regiao.nome}**`),
    CV2.text(pronta
      ? '✅ Sua expedição já terminou! Colete suas recompensas abaixo.'
      : `⏳ Termina <t:${Math.floor(ativa.finalizaEm / 1000)}:R>.`),
    CV2.row(...botoes)
  ], { accentColor: pronta ? ACCENT : 0xF5C542 });
}

function buildResultadoColeta(client, userId, exploration, resultado) {
  const { regiao, estrelas, recursosGanhos, bonus, conquistas, companheiroDescoberto } = resultado;

  const listaRecursos = Object.entries(recursosGanhos)
    .map(([id, qtd]) => `\`+${qtd}\` ${RECURSOS[id]?.emoji ?? '📦'} ${RECURSOS[id]?.nome ?? id}`)
    .join('\n') || 'Nenhum';

  const blocos = [
    CV2.text(`${regiao.emoji} **Expedição concluída!**`),
    CV2.separator(),
    CV2.text(`**⭐ Estrelas:** +${estrelas.toLocaleString()}`),
    CV2.text(`**🎁 Recursos:**\n${listaRecursos}`)
  ];

  if (bonus > 1) {
    blocos.push(CV2.text(`**✨ Bônus de companheiro:** +${Math.round((bonus - 1) * 100)}%`));
  }

  if (companheiroDescoberto) {
    const catalogo = COMPANHEIROS[companheiroDescoberto];
    blocos.push(CV2.text(`**🐾 Novo companheiro!** Você encontrou **${catalogo.emoji} ${catalogo.nome}**! Use \`/companheiros ativar\` pra colocá-lo à frente.`));
  }

  if (conquistas?.length) {
    blocos.push(CV2.text(`**🏅 Conquistas desbloqueadas:**\n${formatarConquistas(conquistas).join('\n')}`));
  }

  blocos.push(CV2.separator());

  const novaBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Nova expedição', style: 1, emoji: { name: '🗺️' } },
    funcao: async (bi) => updateCV2(bi, buildPainelRegioes(client, userId, exploration))
  });

  blocos.push(CV2.row(novaBtn));

  return CV2.container(blocos, { accentColor: ACCENT });
}

async function handleRegioes(interaction, client, exploration, userId) {
  return replyCV2(interaction, buildPainelRegioes(client, userId, exploration));
}

async function handleStatus(interaction, client, exploration, userId) {
  const ativa = await exploration.statusAtual();
  const regiao = ativa ? exploration.getRegiao(ativa.regiaoId) : null;
  return replyCV2(interaction, buildPainelStatus(client, userId, exploration, ativa, regiao));
}

async function handleColetar(interaction, client, exploration, userId) {
  const resultado = await exploration.coletar();
  return editCV2(interaction, client, buildResultadoColeta(client, userId, exploration, resultado));
}
