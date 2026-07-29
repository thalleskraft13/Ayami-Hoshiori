'use strict';

const BankService    = require("../../function/Banco/BankService.js");
const getPerm        = require("../../function/Utils/GetPerm.js");
const { isPlanAtLeast } = require("../../function/Utils/PremiumPlans.js");
const CV2            = require("../../function/Messages/CV2.js");
const {
  economyContext, respondErrorCV2, replyCV2, updateCV2
} = require("../../function/Estrelas/interactionHelpers.js");

const ACCENT = 0x5C6BC0;
const ACCENT_LOCKED = 0x757575;

module.exports = {
  info: {
    name: 'banco',
    description: 'Banco do Servidor'
  },

  data: {
    name: 'banco',
    description: 'Banco do Servidor — economia local exclusiva da assinatura Lua Crescente',
    name_localizations: { 'en-US': 'bank', 'en-GB': 'bank', 'es-ES': 'banco' },
    description_localizations: {
      'en-US': 'Server Bank — local economy exclusive to the Lua Crescente subscription',
      'en-GB': 'Server Bank — local economy exclusive to the Lua Crescente subscription',
      'es-ES': 'Banco del Servidor — economía local exclusiva de la suscripción Lua Crescente',
    },
    options: [
      {
        type: 1,
        name: 'ver',
        description: 'Abre o painel do Banco do Servidor',
        name_localizations: { 'en-US': 'view', 'en-GB': 'view', 'es-ES': 'ver' }
      },
      {
        type: 1,
        name: 'criar',
        description: 'Cria o Banco do Servidor (Lua Crescente ou superior)',
        name_localizations: { 'en-US': 'create', 'en-GB': 'create', 'es-ES': 'crear' },
        options: [
          { type: 3, name: 'nome', description: 'Nome do Banco', required: false, max_length: 100 },
          { type: 3, name: 'descricao', description: 'Descrição do Banco', required: false, max_length: 500 }
        ]
      },
      {
        type: 1,
        name: 'depositar',
        description: 'Deposita Estrelas globais no Banco do Servidor',
        name_localizations: { 'en-US': 'deposit', 'en-GB': 'deposit', 'es-ES': 'depositar' },
        options: [
          { type: 4, name: 'quantidade', description: 'Quantidade de Estrelas a depositar', required: true, min_value: 1 }
        ]
      },
      {
        type: 1,
        name: 'transferir',
        description: 'Transfere moeda local para outro membro do servidor',
        name_localizations: { 'en-US': 'transfer', 'en-GB': 'transfer', 'es-ES': 'transferir' },
        options: [
          { type: 6, name: 'usuario', description: 'Quem vai receber', required: true },
          { type: 10, name: 'quantidade', description: 'Quantidade de moeda local', required: true, min_value: 0.01 }
        ]
      },
      {
        type: 1,
        name: 'emitir',
        description: '[Administradores] Emite moeda local a partir do lastro do Banco',
        name_localizations: { 'en-US': 'issue', 'en-GB': 'issue', 'es-ES': 'emitir' },
        options: [
          { type: 6, name: 'usuario', description: 'Quem vai receber a moeda emitida', required: true },
          { type: 4, name: 'quantidade_estrelas', description: 'Estrelas do lastro a converter em moeda local', required: true, min_value: 1 }
        ]
      },
      {
        type: 1,
        name: 'saldo',
        description: 'Mostra seu saldo local e o lastro do Banco',
        name_localizations: { 'en-US': 'balance', 'en-GB': 'balance', 'es-ES': 'saldo' }
      }
    ]
  },

  async execute(interaction, client) {
    const sub    = interaction.data.options?.[0]?.name;
    const opts   = interaction.data.options?.[0]?.options ?? [];
    const userId = interaction.member?.user?.id ?? interaction.user?.id;
    const getOpt = (name) => opts.find(o => o.name === name)?.value;

    if (!interaction.guild_id)
      return await respondErrorCV2(interaction, "O Banco do Servidor só funciona dentro de um servidor.", client);

    const bank = new BankService(interaction.guild_id, economyContext(interaction, client));

    try {
      switch (sub) {
        case 'ver':        return await handleVer(interaction, client, bank, userId);
        case 'criar':       return await handleCriar(interaction, client, bank, userId, getOpt('nome'), getOpt('descricao'));
        case 'depositar':   return await handleDepositar(interaction, client, bank, userId, getOpt('quantidade'));
        case 'transferir':  return await handleTransferir(interaction, client, bank, userId, getOpt('usuario'), getOpt('quantidade'));
        case 'emitir':      return await handleEmitir(interaction, client, bank, userId, getOpt('usuario'), getOpt('quantidade_estrelas'));
        case 'saldo':       return await handleSaldo(interaction, client, bank, userId);
        default:
          return await respondErrorCV2(interaction, "Subcomando desconhecido.", client);
      }
    } catch (err) {
      console.error('[/banco]', err);
      return await respondErrorCV2(interaction, err.message || "Ocorreu um erro inesperado, tenta de novo em alguns instantes.", client);
    }
  }
};

module.exports.buildPainelBanco = buildPainelBanco;
module.exports.buildPainelSemBanco = buildPainelSemBanco;
module.exports.isAdminAqui = isAdminAqui;
module.exports.formatarMoeda = formatarMoeda;

async function isAdminAqui(interaction, client, bank, userId) {
  const perms = await getPerm({ id: userId, guildId: interaction.guild_id, client }).catch(() => []);
  return bank.isAdmin(userId, perms ?? []);
}

function bloqueado(plan) {
  return CV2.container([
    CV2.text('🏦 **Banco do Servidor**'),
    CV2.text(`Esse recurso é exclusivo da assinatura 🌙 Lua Crescente ou superior. Plano atual do servidor: ${plan.emoji} ${plan.name}.`)
  ], { accentColor: ACCENT_LOCKED });
}

function formatarMoeda(quantidade, moeda) {
  const casas = moeda.casasDecimais ?? 0;
  const valor = casas > 0 ? quantidade.toFixed(casas) : Math.round(quantidade);
  return `${valor} ${moeda.simbolo ?? ''} ${moeda.nome}`.trim();
}

async function handleVer(interaction, client, bank, userId) {
  const plan = await bank.getPlano();
  if (!isPlanAtLeast(plan.key, 'LUA_CRESCENTE')) {
    return replyCV2(interaction, bloqueado(plan));
  }

  const banco = await bank.getBanco();

  if (!banco) {
    return replyCV2(interaction, buildPainelSemBanco(client, userId, bank));
  }

  return replyCV2(interaction, await buildPainelBanco(client, interaction, bank, userId, banco));
}

function buildPainelSemBanco(client, userId, bank) {
  const criarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Criar Banco', style: 3, emoji: { name: '🏦' } },
    funcao: async (bi) => {
      const modal = client.interactions.createModal({
        user: userId,
        title: 'Criar Banco do Servidor',
        components: [
          { type: 1, components: [{ type: 4, custom_id: 'nome', label: 'Nome do Banco', style: 1, required: false, max_length: 100, placeholder: 'Banco do Servidor' }] },
          { type: 1, components: [{ type: 4, custom_id: 'descricao', label: 'Descrição', style: 2, required: false, max_length: 500 }] }
        ],
        funcao: async (mi, _client, fields) => {
          const banco = await bank.criar(userId, { nome: fields.nome, descricao: fields.descricao });
          return updateCV2(mi, await buildPainelBanco(client, mi, bank, userId, banco));
        }
      });
      return client.interactions.showModal(bi, modal);
    }
  });

  return CV2.container([
    CV2.text('🏦 **Banco do Servidor**'),
    CV2.text('Esse servidor ainda não tem um Banco. Crie um para liberar a economia local.'),
    CV2.row(criarBtn)
  ], { accentColor: ACCENT });
}

async function buildPainelBanco(client, interaction, bank, userId, banco) {
  const admin = await isAdminAqui(interaction, client, bank, userId);
  const contaLocal = await bank.saldoLocal(userId).catch(() => 0);

  const blocos = [
    CV2.text(`🏦 **${banco.nome}**`),
    CV2.text(banco.descricao || 'Sem descrição.'),
    CV2.separator(),
    CV2.text(`**Lastro do Banco:** ${banco.saldoEstrelas.toLocaleString()} Estrelas`),
    CV2.text(`**Moeda local:** ${banco.moeda.nome} (${banco.moeda.simbolo}) — taxa 1 Estrela = ${banco.moeda.taxaConversao} ${banco.moeda.nome}`),
    CV2.text(`**Seu saldo local:** ${formatarMoeda(contaLocal, banco.moeda)}`),
    CV2.separator()
  ];

  const depositarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Depositar', style: 1, emoji: { name: '⭐' } },
    funcao: async (bi) => {
      const modal = client.interactions.createModal({
        user: userId,
        title: 'Depositar Estrelas',
        components: [{ type: 1, components: [{ type: 4, custom_id: 'quantidade', label: 'Quantidade de Estrelas', style: 1, required: true, max_length: 10, placeholder: 'Ex: 100' }] }],
        funcao: async (mi, _client, fields) => {
          const quantidade = parseInt(fields.quantidade, 10);
          try {
            if (!Number.isInteger(quantidade)) throw new Error('Digite um número inteiro válido.');
            const bancoAtualizado = await bank.depositar(userId, quantidade);
            return updateCV2(mi, await buildPainelBanco(client, mi, bank, userId, bancoAtualizado));
          } catch (err) {
            return updateCV2(mi, CV2.container([CV2.text('⚠️ **Não deu certo**'), CV2.text(err.message)], { accentColor: 0xE74C3C }));
          }
        }
      });
      return client.interactions.showModal(bi, modal);
    }
  });

  const linhaBotoes = [depositarBtn];

  if (admin) {
    linhaBotoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Configurações', style: 2, emoji: { name: '⚙️' } },
      funcao: async (bi) => updateCV2(bi, await buildPainelConfig(client, bi, bank, userId, banco))
    }));

    linhaBotoes.push(client.interactions.createButton({
      user: userId,
      data: { label: 'Histórico', style: 2, emoji: { name: '📜' } },
      funcao: async (bi) => updateCV2(bi, await buildPainelHistorico(client, bi, bank, userId))
    }));
  }

  blocos.push(CV2.row(...linhaBotoes));

  return CV2.container(blocos, { accentColor: ACCENT });
}

async function buildPainelConfig(client, interaction, bank, userId, banco) {
  const nomeBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Nome e descrição', style: 2 },
    funcao: async (bi) => {
      const modal = client.interactions.createModal({
        user: userId,
        title: 'Editar Banco',
        components: [
          { type: 1, components: [{ type: 4, custom_id: 'nome', label: 'Nome do Banco', style: 1, required: false, max_length: 100, value: banco.nome }] },
          { type: 1, components: [{ type: 4, custom_id: 'descricao', label: 'Descrição', style: 2, required: false, max_length: 500, value: banco.descricao }] }
        ],
        funcao: async (mi, _client, fields) => {
          const atualizado = await bank.configurar(userId, { nome: fields.nome, descricao: fields.descricao });
          return updateCV2(mi, await buildPainelConfig(client, mi, bank, userId, atualizado));
        }
      });
      return client.interactions.showModal(bi, modal);
    }
  });

  const moedaBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Moeda local', style: 2, emoji: { name: '🪙' } },
    funcao: async (bi) => {
      const modal = client.interactions.createModal({
        user: userId,
        title: 'Configurar moeda local',
        components: [
          { type: 1, components: [{ type: 4, custom_id: 'nome', label: 'Nome da moeda', style: 1, required: false, max_length: 40, value: banco.moeda.nome }] },
          { type: 1, components: [{ type: 4, custom_id: 'simbolo', label: 'Símbolo', style: 1, required: false, max_length: 10, value: banco.moeda.simbolo }] },
          { type: 1, components: [{ type: 4, custom_id: 'cor', label: 'Cor (hex, ex: #F5C542)', style: 1, required: false, max_length: 7, value: banco.moeda.cor }] },
          { type: 1, components: [{ type: 4, custom_id: 'taxaConversao', label: 'Taxa: quantidade por 1 Estrela', style: 1, required: false, max_length: 10, value: String(banco.moeda.taxaConversao) }] },
          { type: 1, components: [{ type: 4, custom_id: 'casasDecimais', label: 'Casas decimais (0 a 4)', style: 1, required: false, max_length: 1, value: String(banco.moeda.casasDecimais) }] }
        ],
        funcao: async (mi, _client, fields) => {
          const patch = {};
          if (fields.nome) patch.nome = fields.nome;
          if (fields.simbolo) patch.simbolo = fields.simbolo;
          if (fields.cor) patch.cor = fields.cor;
          if (fields.taxaConversao) {
            const taxa = Number(fields.taxaConversao);
            if (!Number.isFinite(taxa) || taxa <= 0) {
              return updateCV2(mi, CV2.container([CV2.text('⚠️ **Não deu certo**'), CV2.text('Taxa de conversão inválida.')], { accentColor: 0xE74C3C }));
            }
            patch.taxaConversao = taxa;
          }
          if (fields.casasDecimais) {
            const casas = parseInt(fields.casasDecimais, 10);
            if (!Number.isInteger(casas) || casas < 0 || casas > 4) {
              return updateCV2(mi, CV2.container([CV2.text('⚠️ **Não deu certo**'), CV2.text('Casas decimais deve ser um número inteiro entre 0 e 4.')], { accentColor: 0xE74C3C }));
            }
            patch.casasDecimais = casas;
          }

          const atualizado = await bank.configurar(userId, { moeda: patch });
          return updateCV2(mi, await buildPainelConfig(client, mi, bank, userId, atualizado));
        }
      });
      return client.interactions.showModal(bi, modal);
    }
  });

  const adminsBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Administradores', style: 2, emoji: { name: '🛡️' } },
    funcao: async (bi) => updateCV2(bi, await buildPainelAdmins(client, bi, bank, userId, banco))
  });

  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, await buildPainelBanco(client, bi, bank, userId, await bank.getBanco()))
  });

  return CV2.container([
    CV2.text(`⚙️ **Configurações — ${banco.nome}**`),
    CV2.text(`**Moeda:** ${banco.moeda.nome} (${banco.moeda.simbolo}) • taxa ${banco.moeda.taxaConversao} • ${banco.moeda.casasDecimais} casa(s) decimal(is)`),
    CV2.separator(),
    CV2.row(nomeBtn, moedaBtn, adminsBtn),
    CV2.row(voltarBtn)
  ], { accentColor: ACCENT });
}

async function buildPainelAdmins(client, interaction, bank, userId, banco) {
  const lista = banco.administradores.length
    ? banco.administradores.map(id => `<@${id}>`).join('\n')
    : 'Nenhum administrador adicional (apenas Gerenciar Servidor).';

  const adicionarSelect = client.interactions.createUserSelect({
    user: userId,
    data: { placeholder: '➕ Adicionar administrador' },
    funcao: async (si) => {
      const novoId = si.data.values[0];
      const atual = await bank.getBanco();
      const administradores = Array.from(new Set([...(atual.administradores ?? []), novoId]));
      const atualizado = await bank.configurar(userId, { administradores });
      return updateCV2(si, await buildPainelAdmins(client, si, bank, userId, atualizado));
    }
  });

  const removerSelect = client.interactions.createUserSelect({
    user: userId,
    data: { placeholder: '➖ Remover administrador' },
    funcao: async (si) => {
      const alvoId = si.data.values[0];
      const atual = await bank.getBanco();
      const administradores = (atual.administradores ?? []).filter(id => id !== alvoId);
      const atualizado = await bank.configurar(userId, { administradores });
      return updateCV2(si, await buildPainelAdmins(client, si, bank, userId, atualizado));
    }
  });

  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, await buildPainelConfig(client, bi, bank, userId, await bank.getBanco()))
  });

  return CV2.container([
    CV2.text(`🛡️ **Administradores — ${banco.nome}**`),
    CV2.text(lista),
    CV2.separator(),
    CV2.row(adicionarSelect),
    CV2.row(removerSelect),
    CV2.row(voltarBtn)
  ], { accentColor: ACCENT });
}

async function buildPainelHistorico(client, interaction, bank, userId) {
  const entradas = await bank.historico(15);

  const linhas = entradas.length
    ? entradas.map(e => {
        const data = `<t:${Math.floor(e.criadoEm / 1000)}:R>`;
        const quem = e.userId ? `<@${e.userId}>` : 'Sistema';
        return `${data} — ${quem} — ${e.operacao}`;
      }).join('\n')
    : 'Nenhuma movimentação registrada ainda.';

  const voltarBtn = client.interactions.createButton({
    user: userId,
    data: { label: 'Voltar', style: 2, emoji: { name: '🔙' } },
    funcao: async (bi) => updateCV2(bi, await buildPainelBanco(client, bi, bank, userId, await bank.getBanco()))
  });

  return CV2.container([
    CV2.text('📜 **Histórico do Banco**'),
    CV2.text('Últimas 15 movimentações:'),
    CV2.separator(),
    CV2.text(linhas),
    CV2.row(voltarBtn)
  ], { accentColor: ACCENT });
}

async function handleCriar(interaction, client, bank, userId, nome, descricao) {
  const banco = await bank.criar(userId, { nome, descricao });

  return replyCV2(interaction, CV2.container([
    CV2.text('🏦 **Banco criado!**'),
    CV2.text(`**${banco.nome}** está pronto. Use \`/banco ver\` para configurar a moeda local.`)
  ], { accentColor: ACCENT }));
}

async function handleDepositar(interaction, client, bank, userId, quantidade) {
  const banco = await bank.depositar(userId, quantidade);

  return replyCV2(interaction, CV2.container([
    CV2.text('⭐ **Depósito realizado**'),
    CV2.text(`Você depositou **${quantidade}** Estrelas no **${banco.nome}**.`),
    CV2.text(`**Lastro atual:** ${banco.saldoEstrelas.toLocaleString()} Estrelas`)
  ], { accentColor: ACCENT }));
}

async function handleTransferir(interaction, client, bank, userId, alvoId, quantidade) {
  const banco = await bank.getBanco();
  const { contaOrigem } = await bank.transferirLocal(userId, alvoId, quantidade);
  const moeda = banco.moeda;

  return replyCV2(interaction, CV2.container([
    CV2.text('🪙 **Transferência local concluída**'),
    CV2.text(`Você enviou **${formatarMoeda(quantidade, moeda)}** para <@${alvoId}>.`),
    CV2.text(`**Seu saldo local restante:** ${formatarMoeda(contaOrigem.saldoLocal, moeda)}`)
  ], { accentColor: ACCENT }));
}

async function handleEmitir(interaction, client, bank, userId, alvoId, quantidadeEstrelas) {
  const admin = await isAdminAqui(interaction, client, bank, userId);
  if (!admin) {
    return respondErrorCV2(interaction, "Somente administradores do Banco podem emitir moeda local.", client);
  }

  const { banco, moedaEmitida } = await bank.emitir(userId, alvoId, quantidadeEstrelas);

  return replyCV2(interaction, CV2.container([
    CV2.text('🪙 **Moeda emitida**'),
    CV2.text(`<@${alvoId}> recebeu **${formatarMoeda(moedaEmitida, banco.moeda)}**, consumindo **${quantidadeEstrelas}** Estrelas do lastro.`),
    CV2.text(`**Lastro restante:** ${banco.saldoEstrelas.toLocaleString()} Estrelas`)
  ], { accentColor: ACCENT }));
}

async function handleSaldo(interaction, client, bank, userId) {
  const banco = await bank.requireBanco();
  const saldoLocal = await bank.saldoLocal(userId);

  return replyCV2(interaction, CV2.container([
    CV2.text(`🏦 **${banco.nome}**`),
    CV2.text(`**Seu saldo local:** ${formatarMoeda(saldoLocal, banco.moeda)}`),
    CV2.text(`**Lastro do Banco:** ${banco.saldoEstrelas.toLocaleString()} Estrelas`)
  ], { accentColor: ACCENT }));
}
