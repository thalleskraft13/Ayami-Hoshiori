'use strict';

const BankService  = require("../../function/Banco/BankService.js");
const ShopService   = require("../../function/Loja/ShopService.js");
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
    name: 'loja',
    description: 'Loja do Servidor'
  },

  data: {
    name: 'loja',
    description: 'Loja do Servidor — compre produtos com a moeda local',
    name_localizations: { 'en-US': 'shop', 'en-GB': 'shop', 'es-ES': 'tienda' },
    description_localizations: {
      'en-US': 'Server Shop — buy products with the local currency',
      'en-GB': 'Server Shop — buy products with the local currency',
      'es-ES': 'Tienda del Servidor — compra productos con la moneda local',
    },
    options: [
      {
        type: 1,
        name: 'ver',
        description: 'Abre a loja do servidor',
        name_localizations: { 'en-US': 'view', 'en-GB': 'view', 'es-ES': 'ver' }
      },
      {
        type: 1,
        name: 'inventario',
        description: 'Mostra os itens que você já recebeu da loja',
        name_localizations: { 'en-US': 'inventory', 'en-GB': 'inventory', 'es-ES': 'inventario' }
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const userId = interaction.member?.user?.id ?? interaction.user?.id;

    if (!interaction.guild_id)
      return await respondErrorCV2(interaction, "A Loja do Servidor só funciona dentro de um servidor.", client);

    const bank = new BankService(interaction.guild_id, economyContext(interaction, client));
    const shop = new ShopService(interaction.guild_id, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'ver':        return await handleVer(interaction, client, bank, shop, userId);
        case 'inventario':  return await handleInventario(interaction, client, shop, userId);
        default:
          return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/loja]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

module.exports.buildPainelCategorias = buildPainelCategorias;

function bloqueado(plan) {
  return CV2.container([
    CV2.text('🛒 **Loja do Servidor**'),
    CV2.text(`Esse recurso é exclusivo da assinatura 🌙 Lua Crescente ou superior. Plano atual do servidor: ${plan.emoji} ${plan.name}.`)
  ], { accentColor: ACCENT_LOCKED });
}

function formatarMoeda(quantidade, moeda) {
  const casas = moeda.casasDecimais ?? 0;
  const valor = casas > 0 ? quantidade.toFixed(casas) : Math.round(quantidade);
  return `${valor} ${moeda.simbolo ?? ''} ${moeda.nome}`.trim();
}

async function handleVer(interaction, client, bank, shop, userId) {
  const plan = await bank.getPlano();
  if (!isPlanAtLeast(plan.key, 'LUA_CRESCENTE')) {
    return replyCV2(interaction, bloqueado(plan));
  }

  const banco = await bank.getBanco();
  if (!banco) {
    return replyCV2(interaction, CV2.container([
      CV2.text('🛒 **Loja do Servidor**'),
      CV2.text('Esse servidor ainda não tem um Banco do Servidor, então a loja não está disponível.')
    ], { accentColor: ACCENT_LOCKED }));
  }

  const categorias = await shop.listarCategorias();
  return replyCV2(interaction, await buildPainelCategorias(client, userId, bank, shop, banco, categorias));
}

async function buildPainelCategorias(client, userId, bank, shop, banco, categorias) {
  if (!categorias.length) {
    return CV2.container([
      CV2.text('🛒 **Loja do Servidor**'),
      CV2.text('Ainda não há categorias cadastradas na loja.')
    ], { accentColor: ACCENT });
  }

  const select = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: 'Selecione uma categoria',
      options: categorias.slice(0, 25).map(c => ({ label: c.nome, value: String(c._id) }))
    },
    funcao: async (i) => {
      const produtos = await shop.listarProdutos(i.data.values?.[0]);
      return updateCV2(i, await buildPainelProdutos(client, userId, bank, shop, banco, produtos, categorias, i.data.values?.[0]));
    }
  });

  return CV2.container([
    CV2.text('🛒 **Loja do Servidor**'),
    CV2.text('Selecione uma categoria para ver os produtos.'),
    CV2.separator(),
    CV2.row(select)
  ], { accentColor: ACCENT });
}

async function buildPainelProdutos(client, userId, bank, shop, banco, produtos, categorias, categoriaId) {
  const disponiveis = produtos.filter(p => p.ativo && (p.estoque === null || p.estoque > 0));

  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar às categorias', style: 2 },
    funcao: async (i) => updateCV2(i, await buildPainelCategorias(client, userId, bank, shop, banco, categorias))
  });

  if (!disponiveis.length) {
    return CV2.container([
      CV2.text('🛒 **Produtos**'),
      CV2.text('Nenhum produto disponível nessa categoria no momento.'),
      CV2.separator(),
      CV2.row(voltarBtn)
    ], { accentColor: ACCENT });
  }

  const blocos = [CV2.text('🛒 **Produtos**'), CV2.separator()];

  for (const p of disponiveis.slice(0, 10)) {
    blocos.push(CV2.text(
      `**${p.nome}** — ${formatarMoeda(p.preco, banco.moeda)}\n` +
      `${p.descricao || ''}\n` +
      `${p.estoque !== null ? `Estoque: ${p.estoque}` : 'Estoque ilimitado'}`
    ));

    const comprarBtn = client.interactions.createButton({
      user: userId,
      data: { label: `Comprar ${p.nome}`, style: 3 },
      funcao: async (i) => {
        try {
          const { total } = await shop.comprar(userId, String(p._id), 1);
          return updateCV2(i, CV2.container([
            CV2.text('✅ **Compra realizada**'),
            CV2.text(`Você comprou **${p.nome}** por ${formatarMoeda(total, banco.moeda)}.`)
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

  blocos.push(CV2.row(voltarBtn));

  return CV2.container(blocos, { accentColor: ACCENT });
}

async function handleInventario(interaction, client, shop, userId) {
  const itens = await shop.inventario(userId);

  const linhas = itens.length
    ? itens.map(it => `• **${it.itemNome}** x${it.quantidade}`).join('\n')
    : 'Você ainda não tem itens da loja.';

  return replyCV2(interaction, CV2.container([
    CV2.text('🎒 **Seu Inventário**'),
    CV2.text(linhas)
  ], { accentColor: ACCENT }));
}
