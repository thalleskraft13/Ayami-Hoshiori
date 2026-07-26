'use strict';

const CompanionDb  = require("../../Mongodb/companion.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");
const Economy      = require("./Economy.js");
const Missions     = require("./Missions.js");
const CATALOGO     = require("./data/companheiros.js");

const FELICIDADE_MAX = 100;
const FELICIDADE_POR_ALIMENTAR = 20;
const CUSTO_ALIMENTAR = { cogumelos: 2 };

const EVOLUCAO_FELICIDADE_MINIMA = 100;
const EVOLUCAO_CUSTO_ESTRELAS_BASE = 300;
const EVOLUCAO_CUSTO_RECURSO_BASE = { poeiraEstelar: 3 };
const NIVEL_MAXIMO = 5;

class Companion {

  constructor(userId, context = {}) {
    this.userId = userId;
    this.context = context;
  }

  async listar() {
    const companheiros = await CompanionDb.find({ userId: this.userId });
    return companheiros.map(c => ({
      ...c.toObject(),
      catalogo: CATALOGO[c.companheiroId] ?? null
    }));
  }

  async autocompletePossuidos(textoDigitado = '') {
    const busca = String(textoDigitado ?? '').toLowerCase();
    const companheiros = await CompanionDb.find({ userId: this.userId });

    return companheiros
      .map(c => CATALOGO[c.companheiroId])
      .filter(item => item && item.nome.toLowerCase().includes(busca))
      .slice(0, 25)
      .map(item => ({ name: item.nome, value: item.id }));
  }

  async _getPossuido(companheiroId) {
    const companheiro = await CompanionDb.findOne({ userId: this.userId, companheiroId });
    if (!companheiro)
      throw new Error("Você ainda não tem esse companheiro. Descubra-o explorando a região correspondente.");
    return companheiro;
  }

  async ativar(companheiroId) {
    await this._getPossuido(companheiroId);

    await UserGlobalDb.updateOne(
      { userId: this.userId },
      { $set: { companheiroAtivo: companheiroId } }
    );

    return CATALOGO[companheiroId];
  }

  async alimentar(companheiroId) {
    const companheiro = await this._getPossuido(companheiroId);

    if (companheiro.felicidade >= FELICIDADE_MAX)
      throw new Error("Esse companheiro já está no máximo de felicidade.");

    const economy = new Economy(this.userId, this.context);

    for (const [recurso, quantidade] of Object.entries(CUSTO_ALIMENTAR)) {
      await economy.removeResource(recurso, quantidade);
    }

    companheiro.felicidade = Math.min(FELICIDADE_MAX, companheiro.felicidade + FELICIDADE_POR_ALIMENTAR);
    await companheiro.save();

    await Missions.progress(this.userId, this.context, 'alimentar', 1);

    return companheiro;
  }

  async evoluir(companheiroId) {
    const companheiro = await this._getPossuido(companheiroId);

    if (companheiro.nivel >= NIVEL_MAXIMO)
      throw new Error("Esse companheiro já está no nível máximo.");

    if (companheiro.felicidade < EVOLUCAO_FELICIDADE_MINIMA)
      throw new Error(`Esse companheiro precisa estar com felicidade máxima (${EVOLUCAO_FELICIDADE_MINIMA}) para evoluir. Use \`/companheiros alimentar\`.`);

    const custoEstrelas = EVOLUCAO_CUSTO_ESTRELAS_BASE * companheiro.nivel;
    const economy = new Economy(this.userId, this.context);

    for (const [recurso, quantidade] of Object.entries(EVOLUCAO_CUSTO_RECURSO_BASE)) {
      await economy.removeResource(recurso, quantidade * companheiro.nivel);
    }
    await economy.remove(custoEstrelas, { action: 'remove', metadata: { motivo: `Evolução de ${CATALOGO[companheiroId]?.nome ?? companheiroId}` } });

    companheiro.nivel += 1;
    companheiro.felicidade = Math.round(FELICIDADE_MAX * 0.5);
    await companheiro.save();

    await Missions.progress(this.userId, this.context, 'evoluir', 1);

    return companheiro;
  }
}

module.exports = Companion;
