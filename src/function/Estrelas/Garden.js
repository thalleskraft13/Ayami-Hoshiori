'use strict';

const GardenDb   = require("../../Mongodb/garden.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");
const Economy    = require("./Economy.js");
const SEMENTES   = require("./data/sementes.js");
const { construcoes: CONSTRUCOES, decoracoes: DECORACOES } = require("./data/construcoes.js");

class Garden {

  constructor(userId, context = {}) {
    this.userId = userId;
    this.context = context;
  }

  async getOrCreate() {
    let garden = await GardenDb.findOne({ userId: this.userId });

    if (!garden) {
      return GardenDb.create({ userId: this.userId });
    }

    // Auto-repara documentos antigos/incompletos (ex: criados por uma versão
    // anterior com bug, ou parcialmente salvos) para nunca quebrar o comando.
    let precisaSalvar = false;

    if (!Array.isArray(garden.plots) || garden.plots.length === 0) {
      garden.plots = GardenDb.buildDefaultPlots();
      precisaSalvar = true;
    }
    if (!Array.isArray(garden.construcoes)) {
      garden.construcoes = [];
      precisaSalvar = true;
    }
    if (!Array.isArray(garden.decoracoes)) {
      garden.decoracoes = [];
      precisaSalvar = true;
    }

    if (precisaSalvar) {
      garden.markModified('plots');
      await garden.save();
    }

    return garden;
  }

  async plantar(plotIndex, sementeId) {
    const semente = SEMENTES[sementeId];
    if (!semente)
      throw new Error("Essa semente não existe.");

    const garden = await this.getOrCreate();
    const plot = garden.plots.find(p => p.index === plotIndex);

    if (!plot)
      throw new Error(`Esse canteiro não existe. Você tem ${garden.plots.length} canteiro(s) (0 a ${garden.plots.length - 1}).`);

    if (plot.sementeId)
      throw new Error("Esse canteiro já está ocupado. Colha antes de plantar de novo.");

    const economy = new Economy(this.userId, this.context);
    await economy.removeResources(semente.custoRecursos ?? {});

    const agora = Date.now();
    plot.sementeId  = sementeId;
    plot.plantadoEm = agora;
    plot.prontoEm   = agora + semente.tempoMinutos * 60 * 1000;

    garden.markModified('plots');
    await garden.save();
    return { plot, semente };
  }

  async colher(plotIndex) {
    const garden = await this.getOrCreate();
    const plot = garden.plots.find(p => p.index === plotIndex);

    if (!plot || !plot.sementeId)
      throw new Error("Esse canteiro está vazio.");

    if (Date.now() < plot.prontoEm) {
      const restanteMin = Math.ceil((plot.prontoEm - Date.now()) / 60000);
      throw new Error(`Ainda não está pronto. Faltam aproximadamente **${restanteMin} minuto(s)**.`);
    }

    const semente = SEMENTES[plot.sementeId];
    const economy = new Economy(this.userId, this.context);

    for (const [recurso, quantidade] of Object.entries(semente.colheita ?? {})) {
      await economy.addResource(recurso, quantidade);
    }

    plot.sementeId  = null;
    plot.plantadoEm = null;
    plot.prontoEm   = null;

    garden.markModified('plots');
    await garden.save();

    const user = await UserGlobalDb.findOne({ userId: this.userId });
    const conquistas = await this._checarConquistas(user);

    return { semente, conquistas };
  }

  async construir(construcaoId) {
    const construcao = CONSTRUCOES[construcaoId];
    if (!construcao)
      throw new Error("Essa construção não existe.");

    const garden = await this.getOrCreate();

    if (garden.construcoes.includes(construcaoId))
      throw new Error("Você já tem essa construção.");

    const economy = new Economy(this.userId, this.context);

    if (construcao.custoEstrelas && !(await economy.hasBalance(construcao.custoEstrelas))) {
      throw new Error(`Estrelas insuficientes. Você precisa de **${construcao.custoEstrelas}** Estrelas.`);
    }

    await economy.removeResources(construcao.custoRecursos ?? {});

    if (construcao.custoEstrelas) {
      await economy.remove(construcao.custoEstrelas, { action: 'remove', metadata: { motivo: `Construção: ${construcao.nome}` } });
    }

    garden.construcoes.push(construcaoId);

    if (construcaoId === 'canteiro_extra') {
      garden.plots.push({
        index: garden.plots.length,
        sementeId: null,
        plantadoEm: null,
        prontoEm: null
      });
    }

    await garden.save();
    return { construcao, garden };
  }

  async decorar(decoracaoId) {
    const decoracao = DECORACOES[decoracaoId];
    if (!decoracao)
      throw new Error("Essa decoração não existe.");

    const garden = await this.getOrCreate();

    if (garden.decoracoes.includes(decoracaoId))
      throw new Error("Você já tem essa decoração.");

    const economy = new Economy(this.userId, this.context);

    if (decoracao.custoEstrelas && !(await economy.hasBalance(decoracao.custoEstrelas))) {
      throw new Error(`Estrelas insuficientes. Você precisa de **${decoracao.custoEstrelas}** Estrelas.`);
    }

    await economy.removeResources(decoracao.custoRecursos ?? {});

    if (decoracao.custoEstrelas) {
      await economy.remove(decoracao.custoEstrelas, { action: 'remove', metadata: { motivo: `Decoração: ${decoracao.nome}` } });
    }

    garden.decoracoes.push(decoracaoId);
    await garden.save();

    // Decorar contribui para a reputação (colecionismo).
    await UserGlobalDb.updateOne({ userId: this.userId }, { $inc: { reputacao: 5 } });

    return { decoracao, garden };
  }

  async _checarConquistas(user) {
    const novas = [];
    const jaTem = new Set((user.conquistas ?? []).map(c => c.id));

    if (!jaTem.has('primeiro_jardim')) {
      novas.push('primeiro_jardim');
    }

    if (novas.length) {
      await UserGlobalDb.updateOne(
        { userId: this.userId },
        { $push: { conquistas: { $each: novas.map(id => ({ id, obtidoEm: Date.now() })) } } }
      );
    }

    return novas;
  }
}

module.exports = Garden;
