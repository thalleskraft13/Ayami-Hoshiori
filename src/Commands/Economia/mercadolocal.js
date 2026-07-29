'use strict';

const BankService  = require("../../function/Banco/BankService.js");
const LocalMarketService = require("../../function/Mercado/LocalMarketService.js");
const CV2            = require("../../function/Messages/CV2.js");
const { isPlanAtLeast } = require("../../function/Utils/PremiumPlans.js");
const {
  economyContext, respondErrorCV2, replyCV2, updateCV2
} = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0x5C6BC0;
const ACCENT_LOCKED = 0x757575;
const ACCENT_ERROR = 0xE74C3C;

module.exports = {
  info: {
    name: 'mercado-local',
    description: 'Mercado Local do Servidor'
  },

  data: {
    name: 'mercado-local',
    description: 'Compre e venda itens da economia local com outros membros do servidor',
    options: [
      {
        type: 1,
        name: 'vender',
        description: 'Anuncia um item seu no mercado local',
        options: [
          { type: 3, name: 'item', description: 'Nome do item', required: true },
          { type: 4, name: 'quantidade', description: 'Quantidade', required: true, min_value: 1 },
          { type: 4, name: 'preco', description: 'Preço por unidade', required: true, min_value: 1 }
        ]
      },
      {
        type: 1,
        name: 'listar',
        description: 'Lista os anúncios ativos do mercado local'
      },
      {
        type: 1,
        name: 'meus-anuncios',
        description: 'Lista e permite cancelar seus próprios anúncios'
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0];
    const userId = interaction.member?.user?.id ?? interaction.user?.id;

    if (!interaction.guild_id)
      return await respondErrorCV2(interaction, "O Mercado Local só funciona dentro de um servidor.", client);

    const bank   = new BankService(interaction.guild_id, economyContext(interaction, client));
    const market = new LocalMarketService(interaction.guild_id, economyContext(interaction, client));

    try {
      const plan = await bank.getPlano();
      if (!isPlanAtLeast(plan.key, 'LUA_CRESCENTE'))
        return replyCV2(interaction, CV2.container([
          CV2.text('🏪 **Mercado Local**'),
          CV2.text(`Esse recurso é exclusivo da assinatura 🌙 Lua Crescente ou superior. Plano atual do servidor: ${plan.emoji} ${plan.name}.`)
        ], { accentColor: ACCENT_LOCKED }));

      const banco = await bank.getBanco();
      if (!banco)
        return replyCV2(interaction, CV2.container([
          CV2.text('🏪 **Mercado Local**'),
          CV2.text('Esse servidor ainda não tem um Banco do Servidor, então o mercado local não está disponível.')
        ], { accentColor: ACCENT_LOCKED }));

      switch (sub?.name) {
        case 'vender':         return await handleVender(interaction, client, market, banco, userId, sub.options);
        case 'listar':          return await handleListar(interaction, client, market, banco, userId);
        case 'meus-anuncios':    return await handleMeusAnuncios(interaction, client, market, banco, userId);
        default:
          return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/mercado-local]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

function formatarMoeda(quantidade, moeda) {
  const casas = moeda.casasDecimais ?? 0;
  const valor = casas > 0 ? quantidade.toFixed(casas) : Math.round(quantidade);
  return `${valor} ${moeda.simbolo ?? ''} ${moeda.nome}`.trim();
}

function getOpt(options, nome) {
  return options?.find(o => o.name === nome)?.value;
}

async function handleVender(interaction, client, market, banco, userId, options) {
  const item        = getOpt(options, 'item');
  const quantidade  = getOpt(options, 'quantidade');
  const preco       = getOpt(options, 'preco');

  const listing = await market.vender(userId, item, quantidade, preco);

  return replyCV2(interaction, CV2.container([
    CV2.text('🏪 **Anúncio criado**'),
    CV2.text(`**${item}** x${quantidade} por ${formatarMoeda(preco, banco.moeda)}/un.`)
  ], { accentColor: ACCENT }));
}

async function handleListar(interaction, client, market, banco, userId) {
  const anuncios = await market.listarVendas();
  return replyCV2(interaction, await buildPainelListagem(client, userId, market, banco, anuncios));
}

async function buildPainelListagem(client, userId, market, banco, anuncios) {
  if (!anuncios.length) {
    return CV2.container([
      CV2.text('🏪 **Mercado Local**'),
      CV2.text('Nenhum anúncio ativo no momento.')
    ], { accentColor: ACCENT });
  }

  const blocos = [CV2.text('🏪 **Mercado Local**'), CV2.separator()];

  for (const a of anuncios.slice(0, 10)) {
    blocos.push(CV2.text(`**${a.itemNome}** x${a.quantidade} — ${formatarMoeda(a.precoUnitario, banco.moeda)}/un. (vendedor: <@${a.sellerId}>)`));

    if (a.sellerId !== userId) {
      const comprarBtn = client.interactions.createButton({
        user: userId,
        data: { label: `Comprar 1x ${a.itemNome}`, style: 3 },
        funcao: async (i) => {
          try {
            const { total, imposto } = await market.comprar(userId, String(a._id), 1);
            return updateCV2(i, CV2.container([
              CV2.text('✅ **Compra realizada**'),
              CV2.text(`Você comprou **${a.itemNome}** por ${formatarMoeda(total, banco.moeda)}${imposto ? ` (imposto: ${formatarMoeda(imposto, banco.moeda)})` : ''}.`)
            ], { accentColor: ACCENT }));
          } catch (err) {
            return updateCV2(i, CV2.container([
              CV2.text('⚠️ **Não deu certo**'),
              CV2.text(err.message || 'Não foi possível concluir a compra.')
            ], { accentColor: ACCENT_ERROR }));
          }
        }
      });
      blocos.push(CV2.row(comprarBtn));
    }
  }

  return CV2.container(blocos, { accentColor: ACCENT });
}

async function handleMeusAnuncios(interaction, client, market, banco, userId) {
  const todos = await market.listarVendas();
  const meus  = todos.filter(a => a.sellerId === userId);

  if (!meus.length) {
    return replyCV2(interaction, CV2.container([
      CV2.text('🏪 **Meus Anúncios**'),
      CV2.text('Você não tem anúncios ativos.')
    ], { accentColor: ACCENT }));
  }

  const blocos = [CV2.text('🏪 **Meus Anúncios**'), CV2.separator()];

  const select = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: 'Cancelar anúncio',
      options: meus.slice(0, 25).map(a => ({ label: `${a.itemNome} x${a.quantidade}`, value: String(a._id) }))
    },
    funcao: async (i) => {
      await market.cancelarVenda(userId, i.data.values?.[0]);
      return updateCV2(i, CV2.container([
        CV2.text('🏪 **Anúncio cancelado**'),
        CV2.text('O item foi devolvido ao seu inventário.')
      ], { accentColor: ACCENT }));
    }
  });

  for (const a of meus) {
    blocos.push(CV2.text(`**${a.itemNome}** x${a.quantidade} — ${formatarMoeda(a.precoUnitario, banco.moeda)}/un.`));
  }
  blocos.push(CV2.row(select));

  return replyCV2(interaction, CV2.container(blocos, { accentColor: ACCENT }));
}

module.exports.buildPainelListagem = buildPainelListagem;
module.exports.formatarMoeda = formatarMoeda;
