'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const Missions      = require("../../function/Estrelas/Missions.js");
const emojis        = require("../../public/emojis.js");
const { economyContext, respond, respondError, getFocusedOption } = require("../../function/Estrelas/interactionHelpers.js");

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
        description: 'Mostra suas missões ativas',
        name_localizations: { 'en-US': 'view', 'en-GB': 'view', 'es-ES': 'ver' },
        options: [
          {
            type: 3,
            name: 'grupo',
            description: 'Filtrar por grupo (padrão: todas)',
            required: false,
            choices: [
              { name: 'Todas', value: 'todas' },
              { name: 'Diárias', value: 'diaria' },
              { name: 'Semanais', value: 'semanal' },
              { name: 'Mensais', value: 'mensal' }
            ]
          }
        ]
      },
      {
        type: 1,
        name: 'resgatar',
        description: 'Resgata a recompensa de uma missão concluída',
        name_localizations: { 'en-US': 'claim', 'en-GB': 'claim', 'es-ES': 'reclamar' },
        options: [
          { type: 3, name: 'missao', description: 'Missão concluída para resgatar', required: true, autocomplete: true }
        ]
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const opts   = interaction.data.options?.[0]?.options ?? [];
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const getOpt = (name) => opts.find(o => o.name === name)?.value;

    if (!interaction.guild_id)
      return await respondError(interaction, "Missões só funcionam dentro de um servidor.");

    const missions = new Missions(userId, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'ver':       return await handleVer(interaction, missions, getOpt('grupo') ?? 'todas');
        case 'resgatar':  return await handleResgatar(interaction, missions, getOpt('missao'));
        default:          return await respondError(interaction, "Subcomando desconhecido.");
      }
    } catch (err) {
      console.error('[/missoes]', err);
      return await respondError(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.");
    }
  },

  async autocomplete(interaction, client) {
    const focused = getFocusedOption(interaction);
    if (!focused || focused.name !== 'missao') return [];

    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const missions = new Missions(userId, economyContext(interaction, client));
    return await missions.autocompleteResgatar(focused.value);
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

async function handleVer(interaction, missions, grupoFiltro) {
  const grupos = await missions.getMissoes();
  const chaves = grupoFiltro === 'todas' ? ['diaria', 'semanal', 'mensal'] : [grupoFiltro];

  const embed = new MessageEmbed()
    .setTitle(`${emojis.pensando} Suas Missões`)
    .setColor("Gold");

  for (const chave of chaves) {
    const grupo = grupos[chave];
    const texto = grupo.list.map(formatarMissao).join('\n\n') || 'Nenhuma missão ativa.';
    embed.addField(`${NOME_GRUPO[chave]} • renova <t:${Math.floor(grupo.expiresAt / 1000)}:R>`, texto);
  }

  embed.setFooter("Use /missoes resgatar para receber suas recompensas.");

  return await respond(interaction, embed);
}

async function handleResgatar(interaction, missions, missionId) {
  const { missao } = await missions.resgatar(missionId);

  const embed = new MessageEmbed()
    .setTitle("Recompensa resgatada")
    .setColor("Gold")
    .setDescription(`Você recebeu **${missao.recompensas.estrelas}** Estrelas pela missão **${missao.titulo}**.`);

  return await respond(interaction, embed);
}
