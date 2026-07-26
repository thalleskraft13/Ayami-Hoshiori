'use strict';

const MessageEmbed    = require("../../function/Messages/EmbedBuild.js");
const UserGlobalDb    = require("../../Mongodb/userglobal.js");
const Economy         = require("../../function/Estrelas/Economy.js");
const DiscordRequest   = require("../../function/DiscordRequest.js");
const PremiumManager  = require("../../function/Utils/PremiumManager.js");
const { getPlan }     = require("../../function/Utils/PremiumPlans.js");
const { economyContext, respond, respondError } = require("../../function/Estrelas/interactionHelpers.js");
const CV2             = require("../../function/Messages/CV2.js");
const Inventory       = require("../../function/Estrelas/Inventory.js");
const { CATEGORIAS }  = require("../../function/Estrelas/data/itemCatalog.js");

const INV_ITENS_POR_PAGINA = 5;
const INV_ACCENT_COLOR     = 0xF5C542;

const DAILY_BASE        = 150;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

module.exports = {
  info: {
    name: 'estrelas',
    description: 'Economia da Ayami'
  },

  data: {
    name: 'estrelas',
    description: 'Acesse sua economia na Ayami: saldo, perfil, transferências e mais',
    name_localizations: { 'en-US': 'stars', 'en-GB': 'stars', 'es-ES': 'estrellas' },
    description_localizations: {
      'en-US': "Access your Ayami economy: balance, profile, transfers and more",
      'en-GB': "Access your Ayami economy: balance, profile, transfers and more",
      'es-ES': "Accede a tu economía de Ayami: saldo, perfil, transferencias y más",
    },
    options: [
      {
        type: 1,
        name: 'perfil',
        description: 'Mostra seu perfil na economia da Ayami',
        name_localizations: { 'en-US': 'profile', 'en-GB': 'profile', 'es-ES': 'perfil' },
        description_localizations: {
          'en-US': 'Shows your Ayami economy profile',
          'en-GB': 'Shows your Ayami economy profile',
          'es-ES': 'Muestra tu perfil en la economía de Ayami',
        },
        options: [
          {
            type: 6,
            name: 'usuario',
            description: 'Veja o perfil de outra pessoa (opcional)',
            name_localizations: { 'en-US': 'user', 'en-GB': 'user', 'es-ES': 'usuario' },
            required: false
          }
        ]
      },
      {
        type: 1,
        name: 'saldo',
        description: 'Mostra rapidamente seu saldo de Estrelas',
        name_localizations: { 'en-US': 'balance', 'en-GB': 'balance', 'es-ES': 'saldo' },
        description_localizations: {
          'en-US': 'Quickly shows your Stars balance',
          'en-GB': 'Quickly shows your Stars balance',
          'es-ES': 'Muestra rápidamente tu saldo de Estrellas',
        }
      },
      {
        type: 1,
        name: 'diario',
        description: 'Resgata sua recompensa diária de Estrelas',
        name_localizations: { 'en-US': 'daily', 'en-GB': 'daily', 'es-ES': 'diario' },
        description_localizations: {
          'en-US': 'Claims your daily Stars reward',
          'en-GB': 'Claims your daily Stars reward',
          'es-ES': 'Reclama tu recompensa diaria de Estrellas',
        }
      },
      {
        type: 1,
        name: 'transferir',
        description: 'Transfere Estrelas para outra pessoa',
        name_localizations: { 'en-US': 'transfer', 'en-GB': 'transfer', 'es-ES': 'transferir' },
        description_localizations: {
          'en-US': 'Transfers Stars to someone else',
          'en-GB': 'Transfers Stars to someone else',
          'es-ES': 'Transfiere Estrellas a otra persona',
        },
        options: [
          {
            type: 6,
            name: 'destino',
            description: 'Quem vai receber as Estrelas',
            name_localizations: { 'en-US': 'to', 'en-GB': 'to', 'es-ES': 'destino' },
            required: true
          },
          {
            type: 4,
            name: 'quantidade',
            description: 'Quantas Estrelas enviar',
            name_localizations: { 'en-US': 'amount', 'en-GB': 'amount', 'es-ES': 'cantidad' },
            required: true,
            min_value: 1
          },
          {
            type: 3,
            name: 'motivo',
            description: 'Motivo da transferência (opcional)',
            name_localizations: { 'en-US': 'reason', 'en-GB': 'reason', 'es-ES': 'motivo' },
            required: false
          }
        ]
      },
      {
        type: 1,
        name: 'historico',
        description: 'Mostra suas últimas movimentações de Estrelas',
        name_localizations: { 'en-US': 'history', 'en-GB': 'history', 'es-ES': 'historial' },
        description_localizations: {
          'en-US': 'Shows your latest Stars transactions',
          'en-GB': 'Shows your latest Stars transactions',
          'es-ES': 'Muestra tus últimos movimientos de Estrellas',
        }
      },
      {
        type: 1,
        name: 'ranking',
        description: 'Mostra o ranking de Estrelas',
        name_localizations: { 'en-US': 'leaderboard', 'en-GB': 'leaderboard', 'es-ES': 'ranking' },
        description_localizations: {
          'en-US': 'Shows the Stars leaderboard',
          'en-GB': 'Shows the Stars leaderboard',
          'es-ES': 'Muestra el ranking de Estrellas',
        },
        options: [
          {
            type: 3,
            name: 'escopo',
            description: 'Ranking global ou apenas deste servidor (padrão: global)',
            name_localizations: { 'en-US': 'scope', 'en-GB': 'scope', 'es-ES': 'ambito' },
            required: false,
            choices: [
              { name: 'Global', value: 'global' },
              { name: 'Servidor', value: 'servidor' }
            ]
          }
        ]
      },
      {
        type: 1,
        name: 'inventario',
        description: 'Mostra seu inventário',
        name_localizations: { 'en-US': 'inventory', 'en-GB': 'inventory', 'es-ES': 'inventario' },
        description_localizations: {
          'en-US': 'Shows your inventory',
          'en-GB': 'Shows your inventory',
          'es-ES': 'Muestra tu inventario',
        }
      },
      {
        type: 1,
        name: 'migrar',
        description: 'Converte seu saldo antigo de Primogemas em Estrelas (uma única vez)',
        name_localizations: { 'en-US': 'migrate', 'en-GB': 'migrate', 'es-ES': 'migrar' },
        description_localizations: {
          'en-US': 'Converts your old Primogems balance into Stars (one time only)',
          'en-GB': 'Converts your old Primogems balance into Stars (one time only)',
          'es-ES': 'Convierte tu antiguo saldo de Primogemas en Estrellas (una sola vez)',
        }
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const opts   = interaction.data.options?.[0]?.options ?? [];
    const userId = interaction.member?.user?.id ?? interaction.user?.id;

    const getOpt = (name) => opts.find(o => o.name === name)?.value;

    try {
      switch (sub) {
        case 'perfil':    return await handlePerfil(interaction, client, userId, getOpt('usuario'));
        case 'saldo':     return await handleSaldo(interaction, client, userId);
        case 'diario':    return await handleDiario(interaction, client, userId);
        case 'transferir': return await handleTransferir(interaction, client, userId, getOpt('destino'), getOpt('quantidade'), getOpt('motivo'));
        case 'historico': return await handleHistorico(interaction, client, userId);
        case 'ranking':   return await handleRanking(interaction, client, getOpt('escopo') ?? 'global');
        case 'inventario': return await handleInventario(interaction, client, userId);
        case 'migrar':    return await handleMigrar(interaction, client, userId);
        default:
          return await respondError(interaction, "Subcomando desconhecido.");
      }
    } catch (err) {
      console.error('[/estrelas]', err);
      return await respondError(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.");
    }
  }
};

async function handlePerfil(interaction, client, userId, targetUserId) {
  const alvo = targetUserId || userId;
  const user = await UserGlobalDb.findOne({ userId: alvo });

  if (!user) {
    return await respondError(interaction, `<@${alvo}> ainda não tem uma conta na economia da Ayami.`);
  }

  const embed = new MessageEmbed()
    .setTitle(`⭐ Perfil de Estrelas`)
    .setColor("Gold")
    .setDescription(`<@${alvo}>`)
    .addField("💰 Saldo", `\`${user.estrelas.atm.toLocaleString()}\` Estrelas`, true)
    .addField("🏆 Rank de Aventureiro", `#${user.rankaventureiro?.nivelAtual ?? 0}`, true)
    .addField("🌟 Reputação", `${user.reputacao ?? 0}`, true)
    .addField("🧭 Explorações", `${user.estatisticas?.exploracoesTotais ?? 0}`, true)
    .addField("🎒 Expedições", `${user.estatisticas?.expedicoesTotais ?? 0}`, true)
    .addField("🔨 Itens Fabricados", `${user.estatisticas?.itensFabricados ?? 0}`, true)
    .addField("📚 Criações Publicadas", `${user.estatisticas?.criacoesPublicadas ?? 0}`, true)
    .addField("🏅 Conquistas", `${user.conquistas?.length ?? 0}`, true)
    .setFooter("Economia da Ayami")
    .setTimestamp();

  return await respond(interaction, embed);
}

async function handleSaldo(interaction, client, userId) {
  const economy = new Economy(userId, economyContext(interaction, client));
  const log = await economy.getTotal();

  const embed = new MessageEmbed()
    .setTitle("⭐ Seu saldo")
    .setColor("Gold")
    .setDescription(`Você tem **${log.currentBalance.toLocaleString()} Estrelas**.`);

  return await respond(interaction, embed);
}

async function handleDiario(interaction, client, userId) {
  const user = await UserGlobalDb.findOne({ userId }) ?? await UserGlobalDb.create({ userId });
  const agora = Date.now();
  const ultimoResgate = user.estrelas?.dailyTempo ?? 0;
  const restante = ultimoResgate + DAILY_COOLDOWN_MS - agora;

  if (restante > 0) {
    const horas = Math.ceil(restante / (60 * 60 * 1000));
    return await respondError(interaction, `Você já resgatou sua recompensa diária. Volte em aproximadamente **${horas}h**.`);
  }

  const premiumInfo = await PremiumManager.getUserPlan(userId).catch(() => ({ plan: null }));
  const multiplicador = premiumInfo?.plan?.dailyMultiplier ?? getPlan('FREE').dailyMultiplier ?? 1;
  const valor = Math.round(DAILY_BASE * multiplicador);

  const economy = new Economy(userId, economyContext(interaction, client));
  const log = await economy.add(valor, { action: 'daily', metadata: { motivo: 'Recompensa diária' } });

  await UserGlobalDb.updateOne({ userId }, { $set: { 'estrelas.dailyTempo': agora } });

  const embed = new MessageEmbed()
    .setTitle(`${client.emoji?.feliz ?? "⭐"} Recompensa diária resgatada!`)
    .setColor("Green")
    .setDescription(`Você recebeu **+${valor.toLocaleString()} Estrelas**${multiplicador > 1 ? ` (bônus premium x${multiplicador})` : ""}.`)
    .addField("💰 Novo saldo", `\`${log.currentBalance.toLocaleString()}\` Estrelas`, true);

  return await respond(interaction, embed);
}

async function handleTransferir(interaction, client, userId, destinoId, quantidade, motivo) {
  if (!destinoId) {
    return await respondError(interaction, "Você precisa escolher quem vai receber as Estrelas.");
  }

  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    return await respondError(interaction, "A quantidade precisa ser um número inteiro maior que 0.");
  }

  if (destinoId === userId) {
    return await respondError(interaction, "Você não pode transferir Estrelas para si mesmo.");
  }

  const economy = new Economy(userId, economyContext(interaction, client));
  await economy.transferTo(destinoId, quantidade, motivo || null);

  const embed = new MessageEmbed()
    .setTitle("⭐ Transferência concluída")
    .setColor("Green")
    .setDescription(`Você enviou **${quantidade.toLocaleString()} Estrelas** para <@${destinoId}>.${motivo ? `\n📝 Motivo: ${motivo}` : ""}`);

  return await respond(interaction, embed);
}

async function handleHistorico(interaction, client, userId) {
  const user = await UserGlobalDb.findOne({ userId });

  const transacoes = (user?.estrelas?.transacoes ?? []).slice(-10).reverse();

  if (!transacoes.length) {
    const embed = new MessageEmbed()
      .setTitle("📜 Histórico de Estrelas")
      .setColor("Gray")
      .setDescription("Nenhuma movimentação registrada ainda.");

    return await respond(interaction, embed);
  }

  const linhas = transacoes.map(t => {
    const sinal = t.value >= 0 ? "+" : "";
    const data  = t.date ? `<t:${Math.floor(t.date / 1000)}:R>` : "";
    return `\`${sinal}${t.value}\` ⭐ — ${t.type}${t.label ? ` (${t.label})` : ""} ${data}`;
  });

  const embed = new MessageEmbed()
    .setTitle("📜 Histórico de Estrelas")
    .setColor("Gold")
    .setDescription(linhas.join("\n"));

  return await respond(interaction, embed);
}

async function fetchGuildMemberIds(guildId) {
  const ids = new Set();
  let after = undefined;

  for (let pagina = 0; pagina < 10; pagina++) {
    const params = new URLSearchParams({ limit: '1000' });
    if (after) params.set('after', after);

    const lote = await DiscordRequest(`/guilds/${guildId}/members?${params}`, { method: 'GET' });
    if (!Array.isArray(lote) || !lote.length) break;

    for (const membro of lote) {
      if (membro?.user?.id) ids.add(membro.user.id);
    }

    if (lote.length < 1000) break;
    after = lote[lote.length - 1]?.user?.id;
    if (!after) break;
  }

  return ids;
}

async function resolverPerfil(userId, client) {
  try {
    const user = await client.users.getUser(userId);
    const nome = user?.global_name || user?.username || userId;
    return `[${nome}](https://discord.com/users/${userId})`;
  } catch {
    return `[Usuário desconhecido](https://discord.com/users/${userId})`;
  }
}

async function handleRanking(interaction, client, escopo = 'global') {
  const guildId = interaction.guild_id ?? null;

  if (escopo === 'servidor' && !guildId) {
    return await respondError(interaction, "O ranking do servidor só pode ser usado dentro de um servidor.");
  }

  let query = {};

  if (escopo === 'servidor') {
    const memberIds = await fetchGuildMemberIds(guildId);
    if (!memberIds.size) {
      const embed = new MessageEmbed()
        .setTitle("Ranking de Estrelas — Servidor")
        .setColor("Gray")
        .setDescription("Ainda não há ninguém no ranking deste servidor.");

      return await respond(interaction, embed);
    }
    query = { userId: { $in: [...memberIds] } };
  }

  const top = await UserGlobalDb.find(query)
    .sort({ 'estrelas.atm': -1 })
    .limit(10)
    .select({ userId: 1, 'estrelas.atm': 1 });

  const titulo = escopo === 'servidor' ? "Ranking de Estrelas — Servidor" : "Ranking de Estrelas — Global";

  if (!top.length) {
    const embed = new MessageEmbed()
      .setTitle(titulo)
      .setColor("Gray")
      .setDescription("Ainda não há ninguém no ranking.");

    return await respond(interaction, embed);
  }

  const perfis = await Promise.all(top.map(u => resolverPerfil(u.userId, client)));

  const linhas = top.map((u, i) =>
    `\`#${i + 1}\` ${perfis[i]} — **${u.estrelas.atm.toLocaleString()}** Estrelas`
  );

  const embed = new MessageEmbed()
    .setTitle(titulo)
    .setColor("Gold")
    .setDescription(linhas.join("\n"));

  return await respond(interaction, embed);
}

async function handleInventario(interaction, client, userId) {
  const categorias = await Inventory.getInventario(userId);
  const containers = buildInventarioMain(client, userId, categorias);

  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: { type: 4, data: CV2.payload(containers) }
  });
}

function invUpdate(interaction, containers) {
  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: { type: 7, data: CV2.payload(containers) }
  });
}

function invFechar(interaction) {
  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: {
      type: 7,
      data: CV2.payload(CV2.container([
        CV2.text("🎒 Inventário fechado.")
      ], { accentColor: INV_ACCENT_COLOR }))
    }
  });
}

function buildInventarioMain(client, userId, categorias) {
  const linhas = CATEGORIAS
    .map(c => `${c.emoji} **${c.nome}** — ${categorias[c.id].length} tipo(s)`)
    .join("\n");

  const catSelect = client.interactions.createSelect({
    user: userId,
    data: {
      placeholder: "📂 Selecione uma categoria",
      options: CATEGORIAS.map(c => ({
        label: c.nome,
        value: c.id,
        emoji: { name: c.emoji },
        description: `${categorias[c.id].length} tipo(s) de item`
      }))
    },
    funcao: async (si) => {
      const catId = si.data.values[0];
      const catCategorias = await Inventory.getInventario(userId);
      const containers = buildInventarioCategoria(client, userId, catId, catCategorias, 0);
      return invUpdate(si, containers);
    }
  });

  const fecharBtn = client.interactions.createButton({
    user: userId,
    data: { label: "Fechar", style: 4, emoji: { name: "✖️" } },
    funcao: async (bi) => invFechar(bi)
  });

  return CV2.container([
    CV2.text(`🎒 **Inventário** — <@${userId}>`),
    CV2.text(linhas || "Seu inventário ainda está vazio."),
    CV2.separator(),
    CV2.text("Selecione uma categoria abaixo para ver os itens."),
    CV2.row(catSelect),
    CV2.row(fecharBtn)
  ], { accentColor: INV_ACCENT_COLOR });
}

function buildInventarioCategoria(client, userId, catId, categorias, pagina) {
  const cat = CATEGORIAS.find(c => c.id === catId) ?? CATEGORIAS[0];
  const itens = categorias[catId] ?? [];
  const maxPagina = Math.max(0, Math.ceil(itens.length / INV_ITENS_POR_PAGINA) - 1);
  const paginaAtual = Math.min(Math.max(0, pagina), maxPagina);
  const paginaItens = itens.slice(
    paginaAtual * INV_ITENS_POR_PAGINA,
    paginaAtual * INV_ITENS_POR_PAGINA + INV_ITENS_POR_PAGINA
  );

  const blocos = [
    CV2.text(`${cat.emoji} **${cat.nome}** — ${itens.length} tipo(s)`),
    CV2.text(itens.length ? `Página ${paginaAtual + 1}/${maxPagina + 1}` : "Nenhum item nesta categoria ainda."),
    CV2.separator()
  ];

  for (const item of paginaItens) {
    blocos.push(CV2.text(`**${item.emoji} ${item.nome}** \`x${item.quantidade}\`\n${item.descricao}`));
  }

  if (paginaItens.length) {
    blocos.push(CV2.separator());

    const detalheSelect = client.interactions.createSelect({
      user: userId,
      data: {
        placeholder: "🔍 Ver detalhes de um item",
        options: paginaItens.map(item => ({
          label: item.nome.slice(0, 100),
          value: item.id,
          emoji: { name: item.emoji },
          description: `Quantidade: ${item.quantidade}`
        }))
      },
      funcao: async (si) => {
        const catCategorias = await Inventory.getInventario(userId);
        const alvo = (catCategorias[catId] ?? []).find(i => i.id === si.data.values[0]);
        if (!alvo) return invUpdate(si, buildInventarioCategoria(client, userId, catId, catCategorias, paginaAtual));
        return invUpdate(si, buildInventarioDetalhe(client, userId, catId, paginaAtual, alvo));
      }
    });

    blocos.push(CV2.row(detalheSelect));
  }

  const navBotoes = [
    client.interactions.createButton({
      user: userId,
      data: { label: "Voltar", style: 2, emoji: { name: "🔙" } },
      funcao: async (bi) => {
        const catCategorias = await Inventory.getInventario(userId);
        return invUpdate(bi, buildInventarioMain(client, userId, catCategorias));
      }
    })
  ];

  if (paginaAtual > 0) {
    navBotoes.push(client.interactions.createButton({
      user: userId,
      data: { label: "Anterior", style: 2, emoji: { name: "◀️" } },
      funcao: async (bi) => {
        const catCategorias = await Inventory.getInventario(userId);
        return invUpdate(bi, buildInventarioCategoria(client, userId, catId, catCategorias, paginaAtual - 1));
      }
    }));
  }

  if (paginaAtual < maxPagina) {
    navBotoes.push(client.interactions.createButton({
      user: userId,
      data: { label: "Próxima", style: 2, emoji: { name: "▶️" } },
      funcao: async (bi) => {
        const catCategorias = await Inventory.getInventario(userId);
        return invUpdate(bi, buildInventarioCategoria(client, userId, catId, catCategorias, paginaAtual + 1));
      }
    }));
  }

  navBotoes.push(client.interactions.createButton({
    user: userId,
    data: { label: "Fechar", style: 4, emoji: { name: "✖️" } },
    funcao: async (bi) => invFechar(bi)
  }));

  blocos.push(CV2.row(...navBotoes));

  return CV2.container(blocos, { accentColor: INV_ACCENT_COLOR });
}

function buildInventarioDetalhe(client, userId, catId, pagina, item) {
  const detalhes = [
    `**Nome:** ${item.emoji} ${item.nome}`,
    `**Quantidade:** \`${item.quantidade}\``,
    `**Categoria:** ${item.categoria}`,
    `**Descrição:** ${item.descricao}`,
    `**Origem:** ${item.origem}`,
    `**Raridade:** ${item.raridade}`
  ].join("\n");

  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: "Voltar", style: 2, emoji: { name: "🔙" } },
    funcao: async (bi) => {
      const catCategorias = await Inventory.getInventario(userId);
      return invUpdate(bi, buildInventarioCategoria(client, userId, catId, catCategorias, pagina));
    }
  });

  const fecharBtn = client.interactions.createButton({
    user: userId,
    data: { label: "Fechar", style: 4, emoji: { name: "✖️" } },
    funcao: async (bi) => invFechar(bi)
  });

  return CV2.container([
    CV2.text(`🔎 **${item.emoji} ${item.nome}**`),
    CV2.separator(),
    CV2.text(detalhes),
    CV2.separator(),
    CV2.row(voltarBtn, fecharBtn)
  ], { accentColor: INV_ACCENT_COLOR });
}

async function handleMigrar(interaction, client, userId) {
  const economy = new Economy(userId, economyContext(interaction, client));
  const resultado = await economy.migrateLegacyPrimogemas();

  if (resultado.reason === 'already_migrated') {
    return await respondError(interaction, "Sua migração já foi feita anteriormente — não é possível repetir.");
  }

  if (resultado.reason === 'nothing_to_migrate') {
    const embed = new MessageEmbed()
      .setTitle("✅ Nada para migrar")
      .setColor("Gray")
      .setDescription("Não encontramos nenhum saldo antigo de Primogemas na sua conta. Se você é novo por aqui, pode começar a usar Estrelas normalmente!");

    return await respond(interaction, embed);
  }

  const embed = new MessageEmbed()
    .setTitle("✅ Migração concluída")
    .setColor("Green")
    .setDescription(`Convertemos **${resultado.amount.toLocaleString()} Primogemas** em **${resultado.amount.toLocaleString()} Estrelas** (conversão 1:1). Seu progresso foi preservado com segurança.`);

  return await respond(interaction, embed);
}
