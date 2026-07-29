'use strict';

const BankDb        = require("../../Mongodb/bank.js");
const BankAccountDb = require("../../Mongodb/bankAccount.js");
const BankLedgerDb  = require("../../Mongodb/bankLedger.js");
const Economy       = require("../Estrelas/Economy.js");
const PremiumManager = require("../Utils/PremiumManager.js");
const { getPlan, isPlanAtLeast } = require("../Utils/PremiumPlans.js");

const PLANO_MINIMO = 'LUA_CRESCENTE';

class BankService {

  constructor(guildId, context = {}) {
    this.guildId = guildId;
    this.context = context;
  }

  async getBanco() {
    return BankDb.findOne({ guildId: this.guildId });
  }

  async getPlano() {
    const premium = await PremiumManager.getGuildPremium(this.guildId).catch(() => ({ status: false }));
    return premium.status ? getPlan(premium.planId) : getPlan(null);
  }

  async assertPremium() {
    const plan = await this.getPlano();
    if (!isPlanAtLeast(plan.key, PLANO_MINIMO)) {
      throw new Error(`O Banco do Servidor é exclusivo da assinatura 🌙 Lua Crescente ou superior. Plano atual do servidor: ${plan.emoji} ${plan.name}.`);
    }
    return plan;
  }

  async requireBanco() {
    await this.assertPremium();
    const banco = await this.getBanco();
    if (!banco)
      throw new Error("Esse servidor ainda não tem um Banco. Use `/banco criar` para criar um.");
    return banco;
  }

  async isAdmin(userId, permsArray = [], rolesArray = []) {
    if (permsArray.includes('ADMINISTRATOR') || permsArray.includes('MANAGE_GUILD')) return true;
    const banco = await this.getBanco();
    if (banco?.administradores?.includes(userId)) return true;
    const cargosAutorizados = banco?.permissoes?.cargosAutorizados ?? [];
    if (cargosAutorizados.length && rolesArray.length) {
      return rolesArray.some(cargoId => cargosAutorizados.includes(cargoId));
    }
    return false;
  }

  async criar(actorId, { nome, icone, descricao } = {}) {
    await this.assertPremium();

    const existente = await this.getBanco();
    if (existente)
      throw new Error("Esse servidor já possui um Banco.");

    const banco = await BankDb.create({
      guildId: this.guildId,
      nome: nome?.trim() || 'Banco do Servidor',
      icone: icone || null,
      descricao: descricao?.trim() || '',
      criadoPor: actorId
    });

    await this._registrar('admin', actorId, null, 0, `Banco "${banco.nome}" criado`);

    return banco;
  }

  async configurar(actorId, patch = {}) {
    const banco = await this.requireBanco();

    if (patch.nome !== undefined) banco.nome = String(patch.nome).slice(0, 100);
    if (patch.icone !== undefined) banco.icone = patch.icone || null;
    if (patch.descricao !== undefined) banco.descricao = String(patch.descricao).slice(0, 500);

    if (patch.moeda) {
      const moedaAtual = banco.moeda.toObject ? banco.moeda.toObject() : banco.moeda;
      banco.moeda = { ...moedaAtual, ...patch.moeda };
    }

    if (patch.administradores) {
      banco.administradores = patch.administradores;
    }

    if (patch.configuracoesGerais) {
      const atual = banco.configuracoesGerais?.toObject ? banco.configuracoesGerais.toObject() : (banco.configuracoesGerais || {});
      banco.configuracoesGerais = { ...atual, ...patch.configuracoesGerais };
    }

    if (patch.permissoes) {
      const atual = banco.permissoes?.toObject ? banco.permissoes.toObject() : (banco.permissoes || {});
      banco.permissoes = { ...atual, ...patch.permissoes };
    }

    await banco.save();
    await this._registrar('admin', actorId, null, 0, 'Configurações do Banco alteradas', { patch });

    return banco;
  }

  async depositar(userId, quantidade) {
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      await this._registrarFalha(userId, 'deposito', 'Quantidade inválida');
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");
    }

    const banco = await this.requireBanco();

    const economy = new Economy(userId, this.context);
    await economy.remove(quantidade, {
      action: 'banco_deposito',
      metadata: { guildId: this.guildId, banco: banco.nome }
    });

    const anterior = banco.saldoEstrelas;
    banco.saldoEstrelas += quantidade;
    await banco.save();

    await this._registrar('deposito', userId, null, quantidade, `Depósito de ${quantidade} Estrelas`, null, anterior, banco.saldoEstrelas);

    return banco;
  }

  async emitir(actorId, destinoUserId, quantidadeEstrelas) {
    if (!Number.isInteger(quantidadeEstrelas) || quantidadeEstrelas <= 0) {
      await this._registrarFalha(actorId, 'emissao', 'Quantidade inválida');
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");
    }

    const banco = await this.requireBanco();

    if (banco.saldoEstrelas < quantidadeEstrelas) {
      await this._registrarFalha(actorId, 'emissao', 'Lastro insuficiente');
      throw new Error(`Lastro insuficiente. O Banco tem **${banco.saldoEstrelas}** Estrelas disponíveis.`);
    }

    const conta = await this._getOrCreateConta(destinoUserId);
    const moedaEmitida = Math.round(quantidadeEstrelas * (banco.moeda.taxaConversao || 1) * 100) / 100;

    const anteriorBanco = banco.saldoEstrelas;
    banco.saldoEstrelas -= quantidadeEstrelas;
    banco.totalEmitido += moedaEmitida;
    await banco.save();

    conta.saldoLocal += moedaEmitida;
    await conta.save();

    await this._registrar(
      'emissao', actorId, destinoUserId, moedaEmitida,
      `Emissão de ${moedaEmitida} ${banco.moeda.nome} (consumiu ${quantidadeEstrelas} Estrelas do lastro)`,
      { quantidadeEstrelas }, anteriorBanco, banco.saldoEstrelas
    );

    return { banco, conta, moedaEmitida };
  }

  async transferirLocal(deUserId, paraUserId, quantidade) {
    if (deUserId === paraUserId)
      throw new Error("Você não pode transferir para si mesmo.");

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      await this._registrarFalha(deUserId, 'transferencia_local', 'Quantidade inválida');
      throw new Error("Quantidade deve ser maior que 0.");
    }

    const banco = await this.requireBanco();
    const contaOrigem = await this._getOrCreateConta(deUserId);

    if (contaOrigem.saldoLocal < quantidade) {
      await this._registrarFalha(deUserId, 'transferencia_local', 'Saldo local insuficiente');
      throw new Error(`Saldo insuficiente em ${banco.moeda.nome}. Você tem **${contaOrigem.saldoLocal}**.`);
    }

    const contaDestino = await this._getOrCreateConta(paraUserId);

    contaOrigem.saldoLocal -= quantidade;
    contaDestino.saldoLocal += quantidade;
    await contaOrigem.save();
    await contaDestino.save();

    await this._registrar('gasto', deUserId, paraUserId, quantidade, `Transferência local enviada para ${paraUserId}`, null, contaOrigem.saldoLocal + quantidade, contaOrigem.saldoLocal);
    await this._registrar('recebimento', paraUserId, deUserId, quantidade, `Transferência local recebida de ${deUserId}`, null, contaDestino.saldoLocal - quantidade, contaDestino.saldoLocal);

    return { contaOrigem, contaDestino };
  }

  async saldoBanco() {
    const banco = await this.requireBanco();
    return banco.saldoEstrelas;
  }

  async saldoLocal(userId) {
    await this.requireBanco();
    const conta = await this._getOrCreateConta(userId);
    return conta.saldoLocal;
  }

  async creditarLocal(userId, quantidade, operacao, metadata = null) {
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      await this._registrarFalha(userId, operacao, 'Quantidade inválida');
      throw new Error("Quantidade deve ser maior que 0.");
    }

    await this.requireBanco();
    const conta = await this._getOrCreateConta(userId);

    const anterior = conta.saldoLocal;
    conta.saldoLocal += quantidade;
    await conta.save();

    await this._registrar('recebimento', userId, null, quantidade, operacao, metadata, anterior, conta.saldoLocal);

    return conta;
  }

  async arrecadarImposto(quantidade, operacao, metadata = null) {
    if (!Number.isFinite(quantidade) || quantidade <= 0) return null;

    const banco = await this.requireBanco();
    banco.tesouraria = (banco.tesouraria ?? 0) + quantidade;
    await banco.save();

    await this._registrar('admin', null, null, quantidade, operacao, metadata, null, banco.tesouraria);

    return banco;
  }

  async gastarLocal(userId, quantidade, operacao, metadata = null) {
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      await this._registrarFalha(userId, operacao, 'Quantidade inválida');
      throw new Error("Quantidade deve ser maior que 0.");
    }

    const banco = await this.requireBanco();
    const conta = await this._getOrCreateConta(userId);

    if (conta.saldoLocal < quantidade) {
      await this._registrarFalha(userId, operacao, 'Saldo local insuficiente');
      throw new Error(`Saldo insuficiente em ${banco.moeda.nome}. Você tem **${conta.saldoLocal}**.`);
    }

    const anterior = conta.saldoLocal;
    conta.saldoLocal -= quantidade;
    await conta.save();

    await this._registrar('gasto', userId, null, quantidade, operacao, metadata, anterior, conta.saldoLocal);

    return conta;
  }

  async configurarRecompensa(actorId, tipo, patch = {}) {
    const banco = await this.requireBanco();
    let recompensa = banco.recompensas.find(r => r.tipo === tipo);

    if (!recompensa) {
      recompensa = { tipo, valor: 0, cooldownSegundos: 0, limiteDiario: null, cargoObrigatorio: null, cargoBloqueado: null, canalPermitido: null, canalBloqueado: null, ativo: true };
      banco.recompensas.push(recompensa);
      recompensa = banco.recompensas[banco.recompensas.length - 1];
    }

    for (const chave of ['valor', 'cooldownSegundos', 'limiteDiario', 'cargoObrigatorio', 'cargoBloqueado', 'canalPermitido', 'canalBloqueado', 'ativo']) {
      if (patch[chave] !== undefined) recompensa[chave] = patch[chave];
    }

    await banco.save();
    await this._registrar('admin', actorId, null, 0, `Recompensa "${tipo}" configurada`, { tipo, patch });
    return banco;
  }

  async estatisticas() {
    const banco = await this.requireBanco();

    const agora = Date.now();
    const umDia = 24 * 60 * 60 * 1000;

    const [totalMovimentado, totalTransacoes, totalUsuarios, dia, semana, mes] = await Promise.all([
      BankLedgerDb.aggregate([
        { $match: { guildId: this.guildId, sucesso: { $ne: false } } },
        { $group: { _id: null, total: { $sum: '$quantidade' } } }
      ]),
      BankLedgerDb.countDocuments({ guildId: this.guildId }),
      BankAccountDb.countDocuments({ guildId: this.guildId }),
      BankLedgerDb.countDocuments({ guildId: this.guildId, criadoEm: { $gte: agora - umDia } }),
      BankLedgerDb.countDocuments({ guildId: this.guildId, criadoEm: { $gte: agora - 7 * umDia } }),
      BankLedgerDb.countDocuments({ guildId: this.guildId, criadoEm: { $gte: agora - 30 * umDia } }),
    ]);

    const emissoes = await BankLedgerDb.aggregate([
      { $match: { guildId: this.guildId, tipo: 'emissao', sucesso: { $ne: false } } },
      { $group: { _id: null, total: { $sum: '$metadata.quantidadeEstrelas' } } }
    ]);

    return {
      totalMovimentado: totalMovimentado[0]?.total ?? 0,
      totalEmitido: banco.totalEmitido,
      lastroDisponivel: banco.saldoEstrelas,
      lastroUtilizado: emissoes[0]?.total ?? 0,
      totalUsuarios,
      totalTransacoes,
      mediaDiaria: dia,
      mediaSemanal: Math.round((semana / 7) * 100) / 100,
      mediaMensal: Math.round((mes / 30) * 100) / 100,
    };
  }

  async historico(limit = 25) {
    await this.requireBanco();
    return BankLedgerDb.find({ guildId: this.guildId }).sort({ criadoEm: -1 }).limit(limit);
  }

  async configurarImpostos(actorId, patch = {}) {
    const banco = await this.requireBanco();
    const atual = banco.impostos?.toObject ? banco.impostos.toObject() : (banco.impostos || {});
    banco.impostos = { ...atual, ...patch };
    await banco.save();
    await this._registrar('admin', actorId, null, 0, 'Impostos da economia alterados', { patch });
    return banco;
  }

  async adicionarSalario(actorId, { cargoId, valor, intervaloMinutos, limite } = {}) {
    if (!cargoId) throw new Error("Informe um cargo válido.");
    if (!Number.isFinite(valor) || valor <= 0) throw new Error("Valor deve ser maior que 0.");

    const banco = await this.requireBanco();
    const existente = banco.salarios.find(s => s.cargoId === cargoId);

    if (existente) {
      existente.valor = valor;
      existente.intervaloMinutos = Number.isFinite(intervaloMinutos) && intervaloMinutos > 0 ? intervaloMinutos : existente.intervaloMinutos;
      existente.limite = limite ?? existente.limite;
    } else {
      banco.salarios.push({
        cargoId, valor,
        intervaloMinutos: Number.isFinite(intervaloMinutos) && intervaloMinutos > 0 ? intervaloMinutos : 1440,
        limite: limite ?? null,
        ativo: true
      });
    }

    await banco.save();
    await this._registrar('admin', actorId, null, 0, `Salário configurado para cargo ${cargoId}`, { cargoId, valor });
    return banco;
  }

  async removerSalario(actorId, cargoId) {
    const banco = await this.requireBanco();
    banco.salarios = banco.salarios.filter(s => s.cargoId !== cargoId);
    await banco.save();
    await this._registrar('admin', actorId, null, 0, `Salário removido do cargo ${cargoId}`, { cargoId });
    return banco;
  }

  async toggleSalario(actorId, cargoId) {
    const banco = await this.requireBanco();
    const salario = banco.salarios.find(s => s.cargoId === cargoId);
    if (!salario) throw new Error("Esse cargo não tem salário configurado.");
    salario.ativo = !salario.ativo;
    await banco.save();
    await this._registrar('admin', actorId, null, 0, `Salário do cargo ${cargoId} ${salario.ativo ? 'ativado' : 'desativado'}`, { cargoId });
    return banco;
  }

  async _getOrCreateConta(userId) {
    let conta = await BankAccountDb.findOne({ guildId: this.guildId, userId });
    if (!conta) conta = await BankAccountDb.create({ guildId: this.guildId, userId });
    return conta;
  }

  async _registrar(tipo, userId, alvoId, quantidade, operacao, metadata = null, saldoAnterior = null, saldoAtual = null) {
    await BankLedgerDb.create({
      guildId: this.guildId, tipo, userId, alvoId, quantidade, operacao,
      metadata, saldoAnterior, saldoAtual
    }).catch(err => console.error('[BankService] Falha ao registrar ledger:', err));
  }

  async _registrarFalha(userId, operacao, motivo) {
    await BankLedgerDb.create({
      guildId: this.guildId, tipo: 'invalido', userId, quantidade: 0,
      operacao, sucesso: false, motivoFalha: motivo
    }).catch(() => {});
  }
}

module.exports = BankService;
