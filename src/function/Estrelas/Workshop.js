'use strict';

const UserGlobalDb = require("../../Mongodb/userglobal.js");
const Economy      = require("./Economy.js");
const Missions     = require("./Missions.js");
const RECEITAS     = require("./data/receitas.js");

class Workshop {

  constructor(userId, context = {}) {
    this.userId = userId;
    this.context = context;
  }

  listarReceitas() {
    return Object.values(RECEITAS);
  }

  obterReceita(receitaId) {
    return RECEITAS[receitaId] ?? null;
  }

  async fabricar(receitaId, quantidade = 1) {
    if (!Number.isInteger(quantidade) || quantidade <= 0)
      throw new Error("Quantidade deve ser um número inteiro maior que 0.");

    const receita = this.obterReceita(receitaId);
    if (!receita)
      throw new Error("Essa receita não existe.");

    const economy = new Economy(this.userId, this.context);

    const custoRecursos = {};
    for (const [nome, qtd] of Object.entries(receita.custoRecursos ?? {})) {
      custoRecursos[nome] = qtd * quantidade;
    }
    const custoEstrelas = (receita.custoEstrelas ?? 0) * quantidade;

    if (custoEstrelas && !(await economy.hasBalance(custoEstrelas))) {
      throw new Error(`Estrelas insuficientes. Você precisa de **${custoEstrelas}** Estrelas.`);
    }

    if (!(await economy.hasResources(custoRecursos))) {
      throw new Error("Recursos insuficientes para essa fabricação.");
    }

    await economy.removeResources(custoRecursos);

    if (custoEstrelas) {
      await economy.remove(custoEstrelas, {
        action: 'remove',
        metadata: { motivo: `Oficina: ${receita.nome}` }
      });
    }

    const quantidadeProduzida = receita.resultado.quantidade * quantidade;
    await economy.addItem(receita.resultado.itemId, quantidadeProduzida);

    await UserGlobalDb.updateOne(
      { userId: this.userId },
      { $inc: { "estatisticas.itensFabricados": quantidadeProduzida } }
    );

    await Missions.progress(this.userId, this.context, 'fabricar', quantidadeProduzida);

    return { receita, quantidade, quantidadeProduzida };
  }

  autocompleteReceitas(textoDigitado = '') {
    const busca = (textoDigitado ?? '').toLowerCase();

    return this.listarReceitas()
      .filter(r => r.nome.toLowerCase().includes(busca))
      .slice(0, 25)
      .map(r => ({ name: r.nome, value: r.id }));
  }
}

module.exports = Workshop;
