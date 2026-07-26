'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const Exploration  = require("../../function/Estrelas/Exploration.js");
const DURACOES     = require("../../function/Estrelas/data/duracoes.js");
const COMPANHEIROS = require("../../function/Estrelas/data/companheiros.js");
const { economyContext, defer, respond, respondError, formatarConquistas } = require("../../function/Estrelas/interactionHelpers.js");

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
        description: 'Lista as regiões disponíveis para exploração',
        name_localizations: { 'en-US': 'regions', 'en-GB': 'regions', 'es-ES': 'regiones' }
      },
      {
        type: 1,
        name: 'mapa',
        description: 'Mostra o mapa geral das regiões da Ayami',
        name_localizations: { 'en-US': 'map', 'en-GB': 'map', 'es-ES': 'mapa' }
      },
      {
        type: 1,
        name: 'iniciar',
        description: 'Envia seu companheiro ativo em uma expedição',
        name_localizations: { 'en-US': 'start', 'en-GB': 'start', 'es-ES': 'iniciar' },
        options: [
          {
            type: 3,
            name: 'regiao',
            description: 'Região para explorar',
            required: true,
            choices: [
              { name: '🌲 Floresta Nebulosa', value: 'floresta_nebulosa' },
              { name: '🌊 Lago das Estrelas', value: 'lago_das_estrelas' },
              { name: '🌳 Bosque Luminoso',   value: 'bosque_luminoso' },
              { name: '⛰️ Pico Celestial',    value: 'pico_celestial' },
              { name: '🏺 Ruínas Antigas',    value: 'ruinas_antigas' },
            ]
          },
          {
            type: 3,
            name: 'duracao',
            description: 'Duração da expedição',
            required: true,
            choices: [
              { name: '15 minutos', value: '15min' },
              { name: '1 hora',     value: '1h' },
              { name: '6 horas',    value: '6h' },
              { name: '12 horas',   value: '12h' },
            ]
          }
        ]
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
    const opts   = interaction.data.options?.[0]?.options ?? [];
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const getOpt = (name) => opts.find(o => o.name === name)?.value;

    const exploration = new Exploration(userId, economyContext(interaction, client));

    const SUBCOMANDOS_PESADOS = new Set(['iniciar', 'coletar']);
    if (SUBCOMANDOS_PESADOS.has(sub)) {
      await defer(interaction);
    }

    try {
      switch (sub) {
        case 'regioes': return await handleRegioes(interaction, exploration);
        case 'mapa':    return await handleMapa(interaction, exploration);
        case 'iniciar': return await handleIniciar(interaction, client, exploration, getOpt('regiao'), getOpt('duracao'));
        case 'status':  return await handleStatus(interaction, exploration);
        case 'coletar': return await handleColetar(interaction, client, exploration);
        default:
          return await respondError(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/explorar]', err);
      return await respondError(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

async function handleRegioes(interaction, exploration) {
  const regioes = exploration.listarRegioes();

  const embed = new MessageEmbed()
    .setTitle("🗺️ Regiões de Exploração")
    .setColor("Green")
    .setDescription("Use `/explorar iniciar` escolhendo uma delas.");

  for (const regiao of regioes) {
    embed.addField(
      `${regiao.emoji} ${regiao.nome} — Dificuldade ${regiao.dificuldade}`,
      `Recursos: ${regiao.recursos.join(', ')}${regiao.companheiro ? `\nCompanheiro descoberto aqui na primeira expedição!` : ''}`,
      false
    );
  }

  return await respond(interaction, embed);
}

async function handleMapa(interaction, exploration) {
  const regioes = exploration.listarRegioes();

  const linhas = regioes
    .sort((a, b) => a.dificuldade - b.dificuldade)
    .map(r => `${r.emoji} **${r.nome}** — Dificuldade ${'⭐'.repeat(r.dificuldade)}`);

  const embed = new MessageEmbed()
    .setTitle("🗺️ Mapa da Ayami")
    .setColor("Green")
    .setDescription(linhas.join('\n'))
    .setFooter("Use /explorar regioes para ver os recursos de cada uma.");

  return await respond(interaction, embed);
}

async function handleIniciar(interaction, client, exploration, regiaoId, duracaoKey) {
  const { regiao, duracao } = await exploration.iniciar(regiaoId, duracaoKey);

  const embed = new MessageEmbed()
    .setTitle(`${regiao.emoji} Expedição iniciada!`)
    .setColor("Green")
    .setDescription(`Sua expedição para **${regiao.nome}** vai durar **${duracao.label}**.\nUse \`/explorar coletar\` quando estiver pronta.`);

  return await respond(interaction, embed, client);
}

async function handleStatus(interaction, exploration) {
  const ativa = await exploration.statusAtual();

  if (!ativa) {
    const embed = new MessageEmbed()
      .setTitle("🧭 Nenhuma expedição em andamento")
      .setColor("Gray")
      .setDescription("Use `/explorar iniciar` para mandar seu companheiro explorar.");

    return await respond(interaction, embed);
  }

  const regiao   = exploration.getRegiao(ativa.regiaoId);
  const pronta    = Date.now() >= ativa.finalizaEm;

  const embed = new MessageEmbed()
    .setTitle(`${regiao.emoji} Expedição em ${regiao.nome}`)
    .setColor(pronta ? "Green" : "Gold")
    .setDescription(
      pronta
        ? "✅ Sua expedição já terminou! Use `/explorar coletar`."
        : `⏳ Termina <t:${Math.floor(ativa.finalizaEm / 1000)}:R>.`
    );

  return await respond(interaction, embed);
}

async function handleColetar(interaction, client, exploration) {
  const resultado = await exploration.coletar();
  const { regiao, estrelas, recursosGanhos, bonus, conquistas, companheiroDescoberto } = resultado;

  const listaRecursos = Object.entries(recursosGanhos)
    .map(([nome, qtd]) => `\`+${qtd}\` ${nome}`)
    .join('\n');

  const embed = new MessageEmbed()
    .setTitle(`${regiao.emoji} Expedição concluída!`)
    .setColor("Green")
    .addField("⭐ Estrelas", `+${estrelas.toLocaleString()}`, true)
    .addField("🎁 Recursos", listaRecursos || "Nenhum", false);

  if (bonus > 1) {
    embed.addField("✨ Bônus de companheiro", `+${Math.round((bonus - 1) * 100)}%`, true);
  }

  if (companheiroDescoberto) {
    const catalogo = COMPANHEIROS[companheiroDescoberto];
    embed.addField("🐾 Novo companheiro!", `Você encontrou **${catalogo.emoji} ${catalogo.nome}**! Use \`/companheiros ativar\` pra colocá-lo à frente.`, false);
  }

  if (conquistas?.length) {
    embed.addField("🏅 Conquistas desbloqueadas", formatarConquistas(conquistas).join('\n'), false);
  }

  return await respond(interaction, embed, client);
}
