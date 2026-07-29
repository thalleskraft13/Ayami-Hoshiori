'use strict';

const Market         = require("../../function/Estrelas/Market.js");
const Economy        = require("../../function/Estrelas/Economy.js");
const CV2            = require("../../function/Messages/CV2.js");
const {
  economyContext, respondErrorCV2, replyCV2, updateCV2, getFocusedOption
} = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0xFFC107;

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
        name: 'anuncios',
        description: 'Abre o painel interativo de compras do Mercado',
        name_localizations: { 'en-US': 'listings', 'en-GB': 'listings', 'es-ES': 'anuncios' }
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
          case 'criar':  return await handleLeilaoCriar(interaction, client, market, getOpt('item'), getOpt('quantidade'), getOpt('lance_minimo'), getOpt('duracao_minutos'));
          case 'listar': return await handleLeilaoListar(interaction, client, market, userId);
          default: return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
        }
      }

      if (grupo === 'trocar') {
        switch (sub) {
          case 'propor':
            return await handleTrocarPropor(interaction, client, market, {
              alvoId: getOpt('usuario'),
              itemOferecido: getOpt('item_oferecido'),
              quantidadeOferecida: getOpt('quantidade_oferecida') ?? 1,
              estrelasOferecidas: getOpt('estrelas_oferecidas') ?? 0,
              itemSolicitado: getOpt('item_solicitado'),
              quantidadeSolicitada: getOpt('quantidade_solicitada') ?? 1,
              estrelasSolicitadas: getOpt('estrelas_solicitadas') ?? 0
            });
          case 'listar': return await handleTrocarListar(interaction, client, market, userId);
          default: return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
        }
      }

      switch (sub) {
        case 'vender':   return await handleVender(interaction, client, market, getOpt('item'), getOpt('quantidade'), getOpt('preco_unitario'));
        case 'anuncios': return await handleAnuncios(interaction, client, market, userId);
        default:
          return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/mercado]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
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
      default:
        return [];
    }
  }
};

async function handleVender(interaction, client, market, itemId, quantidade, precoUnitario) {
  const listing = await market.vender(itemId, quantidade, precoUnitario);

  return replyCV2(interaction, CV2.container([
    CV2.text('🏷️ **Item anunciado**'),
    CV2.text(`Você colocou **${listing.quantidade}x ${listing.itemId}** à venda por **${listing.precoUnitario}** Estrelas cada.`)
  ], { accentColor: ACCENT }));
}

function buildPainelAnuncios(client, userId, market) {
  return market.listarVendas().then(anuncios => {
    if (!anuncios.length) {
      return CV2.container([
        CV2.text('🛒 **Mercado**'),
        CV2.text('Não há anúncios ativos no momento.')
      ], { accentColor: 0x808080 });
    }

    const select = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: '🛒 Selecione um anúncio',
        options: anuncios.map(a => ({
          label: `${a.itemId} x${a.quantidade}`.slice(0, 100),
          value: String(a._id),
          description: `${a.precoUnitario} Estrelas/un — vendedor ${a.sellerId}`.slice(0, 100)
        }))
      },
      funcao: async (si) => {
        const anuncio = anuncios.find(a => String(a._id) === si.data.values[0]);
        return updateCV2(si, buildDetalheAnuncio(client, userId, market, anuncio));
      }
    });

    const linhas = anuncios.map(a => `**${a.itemId}** x${a.quantidade} — ${a.precoUnitario} Estrelas/un`).join('\n');

    return CV2.container([
      CV2.text('🛒 **Mercado — Anúncios ativos**'),
      CV2.separator(),
      CV2.text(linhas),
      CV2.separator(),
      CV2.row(select)
    ], { accentColor: ACCENT });
  });
}

function buildDetalheAnuncio(client, userId, market, anuncio) {
  const comprarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Comprar 1x', style: 3, emoji: { name: '🛒' } },
    funcao: async (bi) => {
      try {
        const { listing, total } = await market.comprar(String(anuncio._id), 1);
        return updateCV2(bi, CV2.container([
          CV2.text('✅ **Compra concluída**'),
          CV2.text(`Você comprou **1x ${listing.itemId}** por **${total}** Estrelas.`)
        ], { accentColor: 0x4CAF50 }));
      } catch (err) {
        return updateCV2(bi, CV2.container([
          CV2.text('⚠️ **Não deu certo**'),
          CV2.text(err.message)
        ], { accentColor: 0xE74C3C }));
      }
    }
  });

  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, await buildPainelAnuncios(client, userId, market))
  });

  return CV2.container([
    CV2.text(`🏷️ **${anuncio.itemId}**`),
    CV2.text(`**Quantidade disponível:** ${anuncio.quantidade}`),
    CV2.text(`**Preço unitário:** ${anuncio.precoUnitario} Estrelas`),
    CV2.text(`**Vendedor:** <@${anuncio.sellerId}>`),
    CV2.row(comprarBtn, voltarBtn)
  ], { accentColor: ACCENT });
}

async function handleAnuncios(interaction, client, market, userId) {
  return replyCV2(interaction, await buildPainelAnuncios(client, userId, market));
}

async function handleLeilaoCriar(interaction, client, market, itemId, quantidade, lanceMinimo, duracaoMinutos) {
  const leilao = await market.criarLeilao(itemId, quantidade, lanceMinimo, duracaoMinutos);

  return replyCV2(interaction, CV2.container([
    CV2.text('🔨 **Leilão criado**'),
    CV2.text(`Leilão de **${leilao.quantidade}x ${leilao.itemId}** criado, lance mínimo **${leilao.lanceMinimo}** Estrelas.`),
    CV2.text(`**Termina:** <t:${Math.floor(leilao.terminaEm / 1000)}:R>`)
  ], { accentColor: ACCENT }));
}

async function buildPainelLeiloes(client, userId, market) {
  const leiloes = await market.listarLeiloes();

  if (!leiloes.length) {
    return CV2.container([
      CV2.text('🔨 **Leilões ativos**'),
      CV2.text('Não há leilões ativos no momento.')
    ], { accentColor: 0x808080 });
  }

  const select = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '🔨 Selecione um leilão',
      options: leiloes.map(l => ({
        label: `${l.itemId} x${l.quantidade}`.slice(0, 100),
        value: String(l._id),
        description: `Lance atual: ${l.lanceAtual || l.lanceMinimo} Estrelas`.slice(0, 100)
      }))
    },
    funcao: async (si) => {
      return updateCV2(si, await buildDetalheLeilao(client, userId, market, String(si.data.values[0])));
    }
  });

  const linhas = leiloes.map(l =>
    `**${l.quantidade}x ${l.itemId}** — lance atual: ${l.lanceAtual || l.lanceMinimo} Estrelas — termina <t:${Math.floor(l.terminaEm / 1000)}:R>`
  ).join('\n');

  return CV2.container([
    CV2.text('🔨 **Leilões ativos**'),
    CV2.separator(),
    CV2.text(linhas),
    CV2.separator(),
    CV2.row(select)
  ], { accentColor: ACCENT });
}

async function buildDetalheLeilao(client, userId, market, leilaoId) {
  const leiloes = await market.listarLeiloes();
  const leilao = leiloes.find(l => String(l._id) === leilaoId);

  if (!leilao) {
    return CV2.container([
      CV2.text('⚠️ **Leilão não encontrado**'),
      CV2.text('Esse leilão já foi encerrado ou não existe mais.')
    ], { accentColor: 0xE74C3C });
  }

  const lanceBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Dar lance', style: 3, emoji: { name: '💰' } },
    funcao: async (bi) => {
      const modal = client.interactions.createModal({
        user: userId,
        title: `Lance em ${leilao.itemId}`.slice(0, 45),
        components: [{
          type: 1,
          components: [{
            type: 4,
            custom_id: 'valor',
            label: `Valor do lance (mín. ${leilao.lanceAtual > 0 ? leilao.lanceAtual + 1 : leilao.lanceMinimo})`,
            style: 1,
            required: true,
            max_length: 10,
            placeholder: 'Ex: 150'
          }]
        }],
        funcao: async (mi, _client, fields) => {
          const valor = parseInt(fields.valor, 10);
          try {
            if (!Number.isInteger(valor)) throw new Error('Digite um número inteiro válido.');
            await market.darLance(leilaoId, valor);
            return updateCV2(mi, await buildDetalheLeilao(client, userId, market, leilaoId));
          } catch (err) {
            return updateCV2(mi, CV2.container([
              CV2.text('⚠️ **Não deu certo**'),
              CV2.text(err.message)
            ], { accentColor: 0xE74C3C }));
          }
        }
      });
      return client.interactions.showModal(bi, modal);
    }
  });

  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, await buildPainelLeiloes(client, userId, market))
  });

  return CV2.container([
    CV2.text(`🔨 **${leilao.itemId}** x${leilao.quantidade}`),
    CV2.text(`**Lance atual:** ${leilao.lanceAtual || leilao.lanceMinimo} Estrelas`),
    CV2.text(`**Vendedor:** <@${leilao.sellerId}>`),
    CV2.text(`**Termina:** <t:${Math.floor(leilao.terminaEm / 1000)}:R>`),
    CV2.row(lanceBtn, voltarBtn)
  ], { accentColor: ACCENT });
}

async function handleLeilaoListar(interaction, client, market, userId) {
  return replyCV2(interaction, await buildPainelLeiloes(client, userId, market));
}

async function handleTrocarPropor(interaction, client, market, params) {
  const itensProponente = params.itemOferecido ? [{ itemId: params.itemOferecido, quantidade: params.quantidadeOferecida }] : [];
  const itensAlvo       = params.itemSolicitado ? [{ itemId: params.itemSolicitado, quantidade: params.quantidadeSolicitada }] : [];

  await market.propor(
    params.alvoId,
    itensProponente,
    itensAlvo,
    params.estrelasOferecidas,
    params.estrelasSolicitadas
  );

  return replyCV2(interaction, CV2.container([
    CV2.text('🤝 **Troca proposta**'),
    CV2.text(`Proposta enviada para <@${params.alvoId}>. Use \`/mercado trocar listar\` para acompanhar.`)
  ], { accentColor: ACCENT }));
}

async function buildPainelTrocas(client, userId, market) {
  const trades = await market.listarPendentes();

  if (!trades.length) {
    return CV2.container([
      CV2.text('🤝 **Trocas pendentes**'),
      CV2.text('Você não tem trocas pendentes.')
    ], { accentColor: 0x808080 });
  }

  const select = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: '🤝 Selecione uma troca',
      options: trades.map(t => {
        const papel = t.proponenteId === userId ? `Para ${t.alvoId}` : `De ${t.proponenteId}`;
        return {
          label: papel.slice(0, 100),
          value: String(t._id),
          description: market._resumoOferta(t).slice(0, 100)
        };
      })
    },
    funcao: async (si) => {
      return updateCV2(si, await buildDetalheTroca(client, userId, market, String(si.data.values[0])));
    }
  });

  const linhas = trades.map(t => {
    const papel = t.proponenteId === userId ? `Para <@${t.alvoId}>` : `De <@${t.proponenteId}>`;
    return `${papel} — ${market._resumoOferta(t)}`;
  }).join('\n');

  return CV2.container([
    CV2.text('🤝 **Trocas pendentes**'),
    CV2.separator(),
    CV2.text(linhas),
    CV2.separator(),
    CV2.row(select)
  ], { accentColor: ACCENT });
}

async function buildDetalheTroca(client, userId, market, tradeId) {
  const trades = await market.listarPendentes();
  const trade = trades.find(t => String(t._id) === tradeId);

  if (!trade) {
    return CV2.container([
      CV2.text('⚠️ **Troca não encontrada**'),
      CV2.text('Essa troca já foi resolvida.')
    ], { accentColor: 0xE74C3C });
  }

  const ofertaProponente = market._resumoOferta(trade);
  const itensAlvo = trade.itensAlvo.map(i => `${i.quantidade}x ${i.itemId}`);
  if (trade.estrelasAlvo > 0) itensAlvo.push(`${trade.estrelasAlvo} Estrelas`);
  const ofertaAlvo = itensAlvo.join(', ') || 'nada';

  const botoes = [];

  if (trade.alvoId === userId) {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Aceitar', style: 3, emoji: { name: '✅' } },
      funcao: async (bi) => {
        try {
          await market.aceitar(tradeId);
          return updateCV2(bi, CV2.container([
            CV2.text('✅ **Troca aceita**'),
            CV2.text('A troca foi concluída com sucesso.')
          ], { accentColor: 0x4CAF50 }));
        } catch (err) {
          return updateCV2(bi, CV2.container([
            CV2.text('⚠️ **Não deu certo**'),
            CV2.text(err.message)
          ], { accentColor: 0xE74C3C }));
        }
      }
    }));

    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Recusar', style: 4, emoji: { name: '❌' } },
      funcao: async (bi) => {
        await market.recusar(tradeId);
        return updateCV2(bi, CV2.container([
          CV2.text('❌ **Troca recusada**'),
          CV2.text('A troca foi recusada e os itens/Estrelas foram devolvidos ao proponente.')
        ], { accentColor: 0x808080 }));
      }
    }));
  }

  if (trade.proponenteId === userId) {
    botoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Cancelar', style: 4, emoji: { name: '🗑️' } },
      funcao: async (bi) => {
        await market.cancelar(tradeId);
        return updateCV2(bi, CV2.container([
          CV2.text('🗑️ **Troca cancelada**'),
          CV2.text('A troca foi cancelada e seus itens/Estrelas foram devolvidos.')
        ], { accentColor: 0x808080 }));
      }
    }));
  }

  botoes.push(client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, await buildPainelTrocas(client, userId, market))
  }));

  return CV2.container([
    CV2.text(`🤝 **Troca** — De <@${trade.proponenteId}> para <@${trade.alvoId}>`),
    CV2.text(`**${trade.proponenteId === userId ? 'Você oferece' : 'Ele(a) oferece'}:** ${ofertaProponente}`),
    CV2.text(`**${trade.alvoId === userId ? 'Você recebe pedido' : 'Pedido a ele(a)'}:** ${ofertaAlvo}`),
    CV2.row(...botoes)
  ], { accentColor: ACCENT });
}

async function handleTrocarListar(interaction, client, market, userId) {
  return replyCV2(interaction, await buildPainelTrocas(client, userId, market));
}
