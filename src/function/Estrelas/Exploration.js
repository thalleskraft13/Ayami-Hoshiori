'use strict';

const ExpeditionDb = require("../../Mongodb/expedition.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");
const CompanionDb  = require("../../Mongodb/companion.js");
const Economy      = require("./Economy.js");
const Missions     = require("./Missions.js");
const Collections  = require("./Collections.js");
const REGIOES      = require("./data/regioes.js");
const DURACOES     = require("./data/duracoes.js");
const COMPANHEIROS = require("./data/companheiros.js");

const ESTRELAS_BASE_POR_DIFICULDADE = 12;
const BONUS_COMPANHEIRO_AFIM = 1.25;

class Exploration {

  constructor(userId, context = {}) {
    this.userId = userId;
    this.context = context;
  }

  listarRegioes() {
    return Object.values(REGIOES);
  }

  getRegiao(regiaoId) {
    return REGIOES[regiaoId] ?? null;
  }

  listarDuracoes() {
    return DURACOES;
  }

  async statusAtual() {
    return ExpedicaoAtiva(this.userId);
  }

  async iniciar(regiaoId, duracaoKey) {
    const regiao = this.getRegiao(regiaoId);
    if (!regiao)
      throw new Error("Essa região não existe. Use `/explorar regioes` para ver as opções.");

    const duracao = DURACOES[duracaoKey];
    if (!duracao)
      throw new Error("Duração inválida. Use 15min, 1h, 6h ou 12h.");

    const ativa = await ExpedicaoAtiva(this.userId);
    if (ativa)
      throw new Error("Você já tem uma expedição em andamento. Use `/explorar status` para ver o tempo restante.");

    const user = await UserGlobalDb.findOne({ userId: this.userId }) ?? await UserGlobalDb.create({ userId: this.userId });
    const companheiroId = user.companheiroAtivo ?? null;

    const agora = Date.now();
    const finalizaEm = agora + duracao.minutos * 60 * 1000;

    const expedicao = await ExpeditionDb.create({
      userId: this.userId,
      regiaoId,
      duracao: duracaoKey,
      companheiroId,
      iniciadoEm: agora,
      finalizaEm,
      coletado: false
    });

    await Missions.progress(this.userId, this.context, 'explorar_regiao', 1);
    if (companheiroId) {
      await Missions.progress(this.userId, this.context, 'enviar_expedicao', 1);
    }
    Collections.registrar(this.userId, 'regioes', regiaoId);

    return { expedicao, regiao, duracao };
  }

  async coletar() {
    const expedicao = await ExpeditionDb.findOne({ userId: this.userId, coletado: false }).sort({ finalizaEm: -1 });

    if (!expedicao)
      throw new Error("Você não tem nenhuma expedição para coletar. Use `/explorar iniciar` primeiro.");

    if (Date.now() < expedicao.finalizaEm) {
      const restanteMin = Math.ceil((expedicao.finalizaEm - Date.now()) / 60000);
      throw new Error(`Sua expedição ainda não terminou. Faltam aproximadamente **${restanteMin} minuto(s)**.`);
    }

    const regiao   = this.getRegiao(expedicao.regiaoId);
    const duracao  = DURACOES[expedicao.duracao];

    let bonus = 1;
    if (expedicao.companheiroId) {
      const companheiroDono = await CompanionDb.findOne({ userId: this.userId, companheiroId: expedicao.companheiroId });
      const catalogo = COMPANHEIROS[expedicao.companheiroId];
      if (companheiroDono && catalogo?.regiaoAfinidade === expedicao.regiaoId) {
        bonus = BONUS_COMPANHEIRO_AFIM;
      }
    }

    const economy = new Economy(this.userId, this.context);

    const estrelas = Math.round(ESTRELAS_BASE_POR_DIFICULDADE * regiao.dificuldade * duracao.multiplicador * bonus);
    await economy.add(estrelas, { action: 'add', metadata: { motivo: `Expedição: ${regiao.nome}` } });

    const recursosGanhos = {};
    for (const recurso of regiao.recursos) {
      const quantidade = Math.max(1, Math.round(
        (Math.random() * 1.5 + 0.5) * regiao.dificuldade * duracao.multiplicador * bonus
      ));
      await economy.addResource(recurso, quantidade);
      recursosGanhos[recurso] = quantidade;
    }

    expedicao.coletado = true;
    await expedicao.save();

    const user = await UserGlobalDb.findOneAndUpdate(
      { userId: this.userId },
      { $inc: { "estatisticas.exploracoesTotais": 1, "estatisticas.expedicoesTotais": 1 } },
      { new: true }
    );

    const conquistas = await this._checarConquistas(user);

    await Missions.progress(this.userId, this.context, 'concluir_expedicao', 1);
    const totalRecursos = Object.values(recursosGanhos).reduce((soma, qtd) => soma + qtd, 0);
    if (totalRecursos > 0) {
      await Missions.progress(this.userId, this.context, 'coletar_recurso', totalRecursos);
    }

    let companheiroDescoberto = null;
    if (regiao.companheiro) {
      const jaTem = await CompanionDb.findOne({ userId: this.userId, companheiroId: regiao.companheiro });
      if (!jaTem) {
        await CompanionDb.create({ userId: this.userId, companheiroId: regiao.companheiro });
        companheiroDescoberto = regiao.companheiro;
        Collections.registrar(this.userId, 'companheiros', regiao.companheiro);
      }
    }

    return { estrelas, recursosGanhos, bonus, regiao, duracao, conquistas, companheiroDescoberto };
  }

  async _checarConquistas(user) {
    const novas = [];
    const jaTem = new Set((user.conquistas ?? []).map(c => c.id));

    if (!jaTem.has('primeira_expedicao') && user.estatisticas.expedicoesTotais >= 1) {
      novas.push('primeira_expedicao');
    }
    if (!jaTem.has('100_exploracoes') && user.estatisticas.exploracoesTotais >= 100) {
      novas.push('100_exploracoes');
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

async function ExpedicaoAtiva(userId) {
  const expedicao = await ExpeditionDb.findOne({ userId, coletado: false }).sort({ finalizaEm: -1 });
  if (!expedicao) return null;
  return expedicao;
}

module.exports = Exploration;
