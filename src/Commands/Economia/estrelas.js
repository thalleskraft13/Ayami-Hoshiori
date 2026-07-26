'use strict';

const MessageEmbed    = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest  = require("../../function/DiscordRequest.js");
const UserGlobalDb    = require("../../Mongodb/userglobal.js");
const Economy         = require("../../function/Estrelas/Economy.js");
const PremiumManager  = require("../../function/Utils/PremiumManager.js");
const { getPlan }     = require("../../function/Utils/PremiumPlans.js");

const DAILY_BASE        = 150;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function economyContext(interaction, client) {
  return {
    client,
    guildId: interaction.guild_id ?? null,
    actor: interaction.member?.user ?? interaction.user ?? null
  };
}

function respond(interaction, embed) {
  return DiscordRequest(`/interactions/${interaction.id}/${interaction.token}/callback`, {
    method: "POST",
    body: {
      type: 4,
      data: {
        embeds: [embed.build ? embed.build() : embed]
      }
    }
  });
}

function respondError(interaction, mensagem) {
  const embed = new MessageEmbed()
    .setTitle("⚠️ Não deu certo")
    .setDescription(mensagem)
    .setColor("Red");

  return respond(interaction, embed);
}

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
        }
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
        case 'ranking':   return await handleRanking(interaction, client);
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

async function handleRanking(interaction, client) {
  const top = await UserGlobalDb.find({})
    .sort({ 'estrelas.atm': -1 })
    .limit(10)
    .select({ userId: 1, 'estrelas.atm': 1 });

  if (!top.length) {
    const embed = new MessageEmbed()
      .setTitle("🏆 Ranking de Estrelas")
      .setColor("Gray")
      .setDescription("Ainda não há ninguém no ranking.");

    return await respond(interaction, embed);
  }

  const medalhas = ["🥇", "🥈", "🥉"];
  const linhas = top.map((u, i) =>
    `${medalhas[i] ?? `\`#${i + 1}\``} <@${u.userId}> — **${u.estrelas.atm.toLocaleString()}** Estrelas`
  );

  const embed = new MessageEmbed()
    .setTitle("🏆 Ranking de Estrelas")
    .setColor("Gold")
    .setDescription(linhas.join("\n"));

  return await respond(interaction, embed);
}

async function handleInventario(interaction, client, userId) {
  const user = await UserGlobalDb.findOne({ userId });
  const inv = user?.inventario ?? { itens: [], ferramentas: [], decoracoes: [] };

  const embed = new MessageEmbed()
    .setTitle("🎒 Seu Inventário")
    .setColor("Gold")
    .addField("📦 Itens", inv.itens.length ? `${inv.itens.length} item(ns)` : "Vazio", true)
    .addField("🔧 Ferramentas", inv.ferramentas.length ? `${inv.ferramentas.length} ferramenta(s)` : "Vazio", true)
    .addField("🎀 Decorações", inv.decoracoes.length ? `${inv.decoracoes.length} decoração(ões)` : "Vazio", true)
    .setFooter("Novos itens chegam com Exploração, Jardim e Oficina.");

  return await respond(interaction, embed);
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
