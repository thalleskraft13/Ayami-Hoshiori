'use strict';

const Missions       = require("../../function/Estrelas/Missions.js");
const CV2            = require("../../function/Messages/CV2.js");
const {
  economyContext, respondErrorCV2, replyCV2, updateCV2
} = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0xFF9800;

const NOME_GRUPO = { diaria: 'Diárias', semanal: 'Semanais', mensal: 'Mensais' };
const NOME_DIFICULDADE = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', epico: 'Épico' };

module.exports = {
  info: {
    name: 'missoes',
    description: 'Missões da Ayami'
  },

  data: {
    name: 'missoes',
    description: 'Veja e resgate suas missões diárias, semanais e mensais',
    name_localizations: { 'en-US': 'missions', 'en-GB': 'missions', 'es-ES': 'misiones' },
    description_localizations: {
      'en-US': 'View and claim your daily, weekly and monthly missions',
      'en-GB': 'View and claim your daily, weekly and monthly missions',
      'es-ES': 'Consulta y reclama tus misiones diarias, semanales y mensuales',
    },
    options: [
      {
        type: 1,
        name: 'ver',
        description: 'Abre o painel interativo das suas missões',
        name_localizations: { 'en-US': 'view', 'en-GB': 'view', 'es-ES': 'ver' }
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const userId = interaction.member?.user?.id ?? interaction.user?.id;

    if (!interaction.guild_id)
      return await respondErrorCV2(interaction, "Missões só funcionam dentro de um servidor.", client);

    const missions = new Missions(userId, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'ver': return await handleVer(interaction, client, missions, userId);
        default:    return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/missoes]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

function barra(progresso, objetivo, tamanho = 10) {
  const preenchido = Math.min(tamanho, Math.round((progresso / objetivo) * tamanho));
  return '█'.repeat(preenchido) + '░'.repeat(tamanho - preenchido);
}

function formatarMissao(missao) {
  const status = missao.resgatada ? '✅' : (missao.concluida ? '🎁' : '');
  const linha1 = `**${missao.titulo}**${status ? ` ${status}` : ''}`;
  const linha2 = missao.descricao;
  const linha3 = `${barra(missao.progresso, missao.objetivo)}  ${missao.progresso}/${missao.objetivo} • ${NOME_DIFICULDADE[missao.dificuldade]} • ${missao.recompensas.estrelas} Estrelas`;
  return `${linha1}\n${linha2}\n${linha3}`;
}

async function buildPainelMissoes(client, userId, missions, grupoFiltro = 'todas') {
  const grupos = await missions.getMissoes();
  const chaves = grupoFiltro === 'todas' ? ['diaria', 'semanal', 'mensal'] : [grupoFiltro];

  const blocos = [CV2.text('🎯 **Suas Missões**'), CV2.separator()];

  const claimaveis = [];

  for (const chave of chaves) {
    const grupo = grupos[chave];
    const texto = grupo.list.map(formatarMissao).join('\n\n') || 'Nenhuma missão ativa.';
    blocos.push(CV2.text(`**${NOME_GRUPO[chave]}** • renova <t:${Math.floor(grupo.expiresAt / 1000)}:R>\n${texto}`));
    blocos.push(CV2.separator());

    for (const missao of grupo.list) {
      if (missao.concluida && !missao.resgatada) {
        claimaveis.push({ ...missao, grupo: chave });
      }
    }
  }

  const grupoSelect = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '📂 Filtrar por grupo',
      options: [
        { label: 'Todas', value: 'todas', emoji: { name: '🎯' } },
        { label: 'Diárias', value: 'diaria', emoji: { name: '☀️' } },
        { label: 'Semanais', value: 'semanal', emoji: { name: '📅' } },
        { label: 'Mensais', value: 'mensal', emoji: { name: '🗓️' } }
      ]
    },
    funcao: async (si) => updateCV2(si, await buildPainelMissoes(client, userId, missions, si.data.values[0]))
  });

  blocos.push(CV2.row(grupoSelect));

  if (claimaveis.length) {
    const resgatarSelect = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: '🎁 Resgatar recompensa',
        options: claimaveis.map(m => ({
          label: m.titulo.slice(0, 100),
          value: m.id,
          description: `${m.recompensas.estrelas} Estrelas — ${NOME_GRUPO[m.grupo]}`
        }))
      },
      funcao: async (si) => {
        try {
          const { missao } = await missions.resgatar(si.data.values[0]);
          const confirmarBtn = client.interactions.createButton({
            user: userId,
            data: { label: 'Voltar às missões', style: 2, emoji: { name: '🔙' } },
            funcao: async (bi) => updateCV2(bi, await buildPainelMissoes(client, userId, missions, grupoFiltro))
          });
          return updateCV2(si, CV2.container([
            CV2.text('🎁 **Recompensa resgatada**'),
            CV2.text(`Você recebeu **${missao.recompensas.estrelas}** Estrelas pela missão **${missao.titulo}**.`),
            CV2.row(confirmarBtn)
          ], { accentColor: 0x4CAF50 }));
        } catch (err) {
          return updateCV2(si, CV2.container([
            CV2.text('⚠️ **Não deu certo**'),
            CV2.text(err.message)
          ], { accentColor: 0xE74C3C }));
        }
      }
    });
    blocos.push(CV2.row(resgatarSelect));
  }

  return CV2.container(blocos, { accentColor: ACCENT });
}

async function handleVer(interaction, client, missions, userId) {
  return replyCV2(interaction, await buildPainelMissoes(client, userId, missions));
}
