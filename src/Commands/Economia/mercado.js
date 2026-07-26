'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const Market        = require("../../function/Estrelas/Market.js");
const Economy        = require("../../function/Estrelas/Economy.js");
const { economyContext, respond, respondError, getFocusedOption } = require("../../function/Estrelas/interactionHelpers.js");

module.exports = {
  info: {
    name: 'mercado',
    description: 'Mercado da Ayami'
  },

  data: {
    name: 'mercado',
    description: 'Compre, venda, leiloe e troque itens usando Estrelas',
    name_localizations: { 'en-US': 'market', 'en-GB': 'market', 'es-ES': 'mercado' },
    description_localizations: {
      'en-US': 'Buy, sell, auction and trade items using Stars',
      'en-GB': 'Buy, sell, auction and trade items using Stars',
      'es-ES': 'Compra, vende, subasta e intercambia objetos con Estrellas',
    },
    options: [
      {
        type: 1,
        name: 'vender',
        description: 'Anuncia um item do seu inventário para venda',
        name_localizations: { 'en-US': 'sell', 'en-GB': 'sell', 'es-ES': 'vender' },
        options: [
          { type: 3, name: 'item', description: 'Item a vender', required: true, autocomplete: true },
          { type: 4, name: 'quantidade', description: 'Quantidade a vender', required: true, min_value: 1 },
          { type: 4, name: 'preco_unitario', description: 'Preço por unidade em Estrelas', required: true, min_value: 1 }
        ]
      },
      {
        type: 1,
        name: 'comprar',
        description: 'Compra um item anunciado no Mercado',
        name_localizations: { 'en-US': 'buy', 'en-GB': 'buy', 'es-ES': 'comprar' },
        options: [
          { type: 3, name: 'anuncio', description: 'Anúncio a comprar', required: true, autocomplete: true },
          { type: 4, name: 'quantidade', description: 'Quantidade a comprar (padrão: 1)', required: false, min_value: 1 }
        ]
      },
      {
        type: 2,
        name: 'leilao',
        description: 'Leilões do Mercado',
        name_localizations: { 'en-US': 'auction', 'en-GB': 'auction', 'es-ES': 'subasta' },
        options: [
          {
            type: 1,
            name: 'criar',
            description: 'Cria um leilão com um item do seu inventário',
            options: [
              { type: 3, name: 'item', description: 'Item a leiloar', required: true, autocomplete: true },
              { type: 4, name: 'quantidade', description: 'Quantidade a leiloar', required: true, min_value: 1 },
              { type: 4, name: 'lance_minimo', description: 'Lance mínimo em Estrelas', required: true, min_value: 1 },
              { type: 4, name: 'duracao_minutos', description: 'Duração em minutos (padrão: 60)', required: false, min_value: 10 }
            ]
          },
          {
            type: 1,
            name: 'listar',
            description: 'Mostra os leilões ativos'
          },
          {
            type: 1,
            name: 'lance',
            description: 'Dá um lance em um leilão ativo',
            options: [
              { type: 3, name: 'leilao', description: 'Leilão para dar lance', required: true, autocomplete: true },
              { type: 4, name: 'valor', description: 'Valor do lance em Estrelas', required: true, min_value: 1 }
            ]
          }
        ]
      },
      {
        type: 2,
        name: 'trocar',
        description: 'Trocas diretas entre usuários',
        name_localizations: { 'en-US': 'trade', 'en-GB': 'trade', 'es-ES': 'intercambiar' },
        options: [
          {
            type: 1,
            name: 'propor',
            description: 'Propõe uma troca para outro usuário',
            options: [
              { type: 6, name: 'usuario', description: 'Com quem trocar', required: true },
              { type: 3, name: 'item_oferecido', description: 'Item que você oferece', required: false, autocomplete: true },
              { type: 4, name: 'quantidade_oferecida', description: 'Quantidade oferecida (padrão: 1)', required: false, min_value: 1 },
              { type: 4, name: 'estrelas_oferecidas', description: 'Estrelas que você oferece', required: false, min_value: 1 },
              { type: 3, name: 'item_solicitado', description: 'Item que você quer receber', required: false },
              { type: 4, name: 'quantidade_solicitada', description: 'Quantidade solicitada (padrão: 1)', required: false, min_value: 1 },
              { type: 4, name: 'estrelas_solicitadas', description: 'Estrelas que você quer receber', required: false, min_value: 1 }
            ]
          },
          {
            type: 1,
            name: 'aceitar',
            description: 'Aceita uma troca proposta para você',
            options: [
              { type: 3, name: 'troca', description: 'Troca a aceitar', required: true, autocomplete: true }
            ]
          },
          {
            type: 1,
            name: 'recusar',
            description: 'Recusa uma troca proposta para você',
            options: [
              { type: 3, name: 'troca', description: 'Troca a recusar', required: true, autocomplete: true }
            ]
          },
          {
            type: 1,
            name: 'cancelar',
            description: 'Cancela uma troca que você propôs',
            options: [
              { type: 3, name: 'troca', description: 'Troca a cancelar', required: true, autocomplete: true }
            ]
          },
          {
            type: 1,
            name: 'listar',
            description: 'Mostra suas trocas pendentes'
          }
        ]
      }
    ]
  },

  async execute(interaction, client) {
    const primeiro = interaction.data.options?.[0];
    const isGrupo  = primeiro?.type === 2;
    const sub      = isGrupo ? primeiro.options?.[0]?.name : primeiro?.name;
    const opts     = isGrupo ? (primeiro.options?.[0]?.options ?? []) : (primeiro?.options ?? []);
    const grupo    = isGrupo ? primeiro.name : null;
    const userId   = interaction.member?.user?.id ?? interaction.user?.id;
    const getOpt   = (name) => opts.find(o => o.name === name)?.value;

    const market = new Market(userId, economyContext(interaction, client));

    try {
      if (grupo === 'leilao') {
        switch (sub) {
          case 'criar':  return await handleLeilaoCriar(interaction, market, getOpt('item'), getOpt('quantidade'), getOpt('lance_minimo'), getOpt('duracao_minutos'));
          case 'listar': return await handleLeilaoListar(interaction, market);
          case 'lance':  return await handleLeilaoLance(interaction, market, getOpt('leilao'), getOpt('valor'));
          default: return await respondError(interaction, "Subcomando desconhecido.");
        }
      }

      if (grupo === 'trocar') {
        switch (sub) {
          case 'propor':
            return await handleTrocarPropor(interaction, market, {
              alvoId: getOpt('usuario'),
              itemOferecido: getOpt('item_oferecido'),
              quantidadeOferecida: getOpt('quantidade_oferecida') ?? 1,
              estrelasOferecidas: getOpt('estrelas_oferecidas') ?? 0,
              itemSolicitado: getOpt('item_solicitado'),
              quantidadeSolicitada: getOpt('quantidade_solicitada') ?? 1,
              estrelasSolicitadas: getOpt('estrelas_solicitadas') ?? 0
            });
          case 'aceitar': return await handleTrocarAceitar(interaction, market, getOpt('troca'));
          case 'recusar': return await handleTrocarRecusar(interaction, market, getOpt('troca'));
          case 'cancelar': return await handleTrocarCancelar(interaction, market, getOpt('troca'));
          case 'listar':  return await handleTrocarListar(interaction, market);
          default: return await respondError(interaction, "Subcomando desconhecido.");
        }
      }

      switch (sub) {
        case 'vender':  return await handleVender(interaction, market, getOpt('item'), getOpt('quantidade'), getOpt('preco_unitario'));
        case 'comprar': return await handleComprar(interaction, market, getOpt('anuncio'), getOpt('quantidade') ?? 1);
        default:
          return await respondError(interaction, "Subcomando desconhecido.");
      }
    } catch (err) {
      console.error('[/mercado]', err);
      return await respondError(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.");
    }
  },

  async autocomplete(interaction, client) {
    const focused = getFocusedOption(interaction);
    if (!focused) return [];

    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const market  = new Market(userId, economyContext(interaction, client));
    const economy = new Economy(userId, economyContext(interaction, client));

    switch (focused.name) {
      case 'item':
      case 'item_oferecido': {
        const itens = await economy.getItems();
        const busca = (focused.value ?? '').toLowerCase();
        return itens
          .filter(i => i.itemId.toLowerCase().includes(busca))
          .slice(0, 25)
          .map(i => ({ name: `${i.itemId} (você tem ${i.quantidade})`, value: i.itemId }));
      }
      case 'anuncio':
        return market.autocompleteVendas(focused.value);
      case 'leilao':
        return market.autocompleteLeiloes(focused.value);
      case 'troca': {
        const recebidas = await market.autocompletePendentesRecebidas();
        const enviadas  = await market.autocompletePendentesEnviadas();
        return [...recebidas, ...enviadas].slice(0, 25);
      }
      default:
        return [];
    }
  }
};

async function handleVender(interaction, market, itemId, quantidade, precoUnitario) {
  const listing = await market.vender(itemId, quantidade, precoUnitario);

  const embed = new MessageEmbed()
    .setTitle("Item anunciado")
    .setColor("Gold")
    .setDescription(`Você colocou **${listing.quantidade}x ${listing.itemId}** à venda por **${listing.precoUnitario}** Estrelas cada.`);

  return await respond(interaction, embed);
}

async function handleComprar(interaction, market, listingId, quantidade) {
  const { listing, total } = await market.comprar(listingId, quantidade);

  const embed = new MessageEmbed()
    .setTitle("Compra concluída")
    .setColor("Gold")
    .setDescription(`Você comprou **${quantidade}x ${listing.itemId}** por **${total}** Estrelas.`);

  return await respond(interaction, embed);
}

async function handleLeilaoCriar(interaction, market, itemId, quantidade, lanceMinimo, duracaoMinutos) {
  const leilao = await market.criarLeilao(itemId, quantidade, lanceMinimo, duracaoMinutos);

  const embed = new MessageEmbed()
    .setTitle("Leilão criado")
    .setColor("Gold")
    .setDescription(`Leilão de **${leilao.quantidade}x ${leilao.itemId}** criado, lance mínimo **${leilao.lanceMinimo}** Estrelas.`)
    .addField("Termina", `<t:${Math.floor(leilao.terminaEm / 1000)}:R>`, true);

  return await respond(interaction, embed);
}

async function handleLeilaoListar(interaction, market) {
  const leiloes = await market.listarLeiloes();

  if (!leiloes.length) {
    const embed = new MessageEmbed()
      .setTitle("Leilões ativos")
      .setColor("Gray")
      .setDescription("Não há leilões ativos no momento.");
    return await respond(interaction, embed);
  }

  const linhas = leiloes.map(l =>
    `**${l.quantidade}x ${l.itemId}** — lance atual: ${l.lanceAtual || l.lanceMinimo} Estrelas — termina <t:${Math.floor(l.terminaEm / 1000)}:R>`
  );

  const embed = new MessageEmbed()
    .setTitle("Leilões ativos")
    .setColor("Gold")
    .setDescription(linhas.join('\n'));

  return await respond(interaction, embed);
}

async function handleLeilaoLance(interaction, market, leilaoId, valor) {
  const leilao = await market.darLance(leilaoId, valor);

  const embed = new MessageEmbed()
    .setTitle("Lance registrado")
    .setColor("Gold")
    .setDescription(`Seu lance de **${valor}** Estrelas foi registrado em **${leilao.itemId}**.`);

  return await respond(interaction, embed);
}

async function handleTrocarPropor(interaction, market, params) {
  const itensProponente = params.itemOferecido ? [{ itemId: params.itemOferecido, quantidade: params.quantidadeOferecida }] : [];
  const itensAlvo       = params.itemSolicitado ? [{ itemId: params.itemSolicitado, quantidade: params.quantidadeSolicitada }] : [];

  const trade = await market.propor(
    params.alvoId,
    itensProponente,
    itensAlvo,
    params.estrelasOferecidas,
    params.estrelasSolicitadas
  );

  const embed = new MessageEmbed()
    .setTitle("Troca proposta")
    .setColor("Gold")
    .setDescription(`Proposta enviada para <@${params.alvoId}>. Use \`/mercado trocar listar\` para acompanhar.`);

  return await respond(interaction, embed);
}

async function handleTrocarAceitar(interaction, market, tradeId) {
  await market.aceitar(tradeId);

  const embed = new MessageEmbed()
    .setTitle("Troca aceita")
    .setColor("Gold")
    .setDescription("A troca foi concluída com sucesso.");

  return await respond(interaction, embed);
}

async function handleTrocarRecusar(interaction, market, tradeId) {
  await market.recusar(tradeId);

  const embed = new MessageEmbed()
    .setTitle("Troca recusada")
    .setColor("Gray")
    .setDescription("A troca foi recusada e os itens/Estrelas foram devolvidos ao proponente.");

  return await respond(interaction, embed);
}

async function handleTrocarCancelar(interaction, market, tradeId) {
  await market.cancelar(tradeId);

  const embed = new MessageEmbed()
    .setTitle("Troca cancelada")
    .setColor("Gray")
    .setDescription("A troca foi cancelada e seus itens/Estrelas foram devolvidos.");

  return await respond(interaction, embed);
}

async function handleTrocarListar(interaction, market) {
  const trades = await market.listarPendentes();

  if (!trades.length) {
    const embed = new MessageEmbed()
      .setTitle("Trocas pendentes")
      .setColor("Gray")
      .setDescription("Você não tem trocas pendentes.");
    return await respond(interaction, embed);
  }

  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const linhas = trades.map(t => {
    const papel = t.proponenteId === userId ? `Para <@${t.alvoId}>` : `De <@${t.proponenteId}>`;
    return `\`${t._id}\` — ${papel} — ${market._resumoOferta(t)}`;
  });

  const embed = new MessageEmbed()
    .setTitle("Trocas pendentes")
    .setColor("Gold")
    .setDescription(linhas.join('\n'));

  return await respond(interaction, embed);
}
