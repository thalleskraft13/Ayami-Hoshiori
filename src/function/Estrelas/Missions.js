'use strict';

const UserMissionDb = require("../../Mongodb/userMission.js");
const Economy = require("./Economy.js");
const {
  TEMPLATES,
  TEMPLATES_BY_ID,
  sortearDificuldade,
  calcularMeta,
  calcularRecompensa
} = require("./data/missionTemplates.js");

const GRUPOS = ['diaria', 'semanal', 'mensal'];
const MISSOES_POR_GRUPO = 4;

const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA_MS = 7 * DIA_MS;

function fimDoProximoMes(agora) {
  const d = new Date(agora);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0);
}

function proximaExpiracao(grupo, agora) {
  if (grupo === 'diaria') return agora + DIA_MS;
  if (grupo === 'semanal') return agora + SEMANA_MS;
  return fimDoProximoMes(agora);
}

function shuffle(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function gerarMissoesDoGrupo(grupo, agora) {
  const escolhidos = shuffle(TEMPLATES).slice(0, MISSOES_POR_GRUPO);

  const list = escolhidos.map((template, index) => {
    const dificuldade = sortearDificuldade();
    const objetivo = calcularMeta(template, grupo, dificuldade);
    const estrelas = calcularRecompensa(template, grupo, dificuldade);

    return {
      id: `${grupo}_${agora}_${index}`,
      templateId: template.id,
      categoria: template.categoria,
      acao: template.acao,
      titulo: template.titulo,
      descricao: template.descricao.replace('{meta}', objetivo),
      dificuldade,
      objetivo,
      progresso: 0,
      recompensas: { estrelas },
      concluida: false,
      resgatada: false
    };
  });

  return { generatedAt: agora, expiresAt: proximaExpiracao(grupo, agora), list };
}

class Missions {

  constructor(userId, context = {}) {
    this.userId = userId;
    this.guildId = context.guildId ?? null;
    this.context = context;
  }

  async _getOrCreate() {
    if (!this.guildId)
      throw new Error("Missões só existem dentro de um servidor.");

    let doc = await UserMissionDb.findOne({ userId: this.userId, guildId: this.guildId });

    if (!doc) {
      doc = await UserMissionDb.create({ userId: this.userId, guildId: this.guildId });
    }

    return this._renovarSeNecessario(doc);
  }

  async _renovarSeNecessario(doc) {
    const agora = Date.now();
    let precisaSalvar = false;

    for (const grupo of GRUPOS) {
      if (!doc[grupo]?.expiresAt || agora >= doc[grupo].expiresAt) {
        doc[grupo] = gerarMissoesDoGrupo(grupo, agora);
        precisaSalvar = true;
      }
    }

    if (precisaSalvar) {
      doc.markModified('diaria');
      doc.markModified('semanal');
      doc.markModified('mensal');
      await doc.save();
    }

    return doc;
  }

  async getMissoes() {
    const doc = await this._getOrCreate();
    return {
      diaria: doc.diaria,
      semanal: doc.semanal,
      mensal: doc.mensal
    };
  }

  async registrarProgresso(acao, quantidade = 1) {
    if (!this.guildId || quantidade <= 0) return null;

    const doc = await this._getOrCreate();
    let alterou = false;
    const concluidas = [];

    for (const grupo of GRUPOS) {
      for (const missao of doc[grupo].list) {
        if (missao.acao !== acao || missao.concluida) continue;

        missao.progresso = Math.min(missao.objetivo, missao.progresso + quantidade);
        alterou = true;

        if (missao.progresso >= missao.objetivo) {
          missao.concluida = true;
          concluidas.push({ grupo, missao });
        }
      }
    }

    if (alterou) {
      doc.markModified('diaria');
      doc.markModified('semanal');
      doc.markModified('mensal');
      await doc.save();
    }

    return { concluidas };
  }

  async resgatar(missionId) {
    const doc = await this._getOrCreate();

    let alvo = null;
    let grupoAlvo = null;

    for (const grupo of GRUPOS) {
      const missao = doc[grupo].list.find(m => m.id === missionId);
      if (missao) {
        alvo = missao;
        grupoAlvo = grupo;
        break;
      }
    }

    if (!alvo)
      throw new Error("Essa missão não existe ou já expirou.");

    if (!alvo.concluida)
      throw new Error("Essa missão ainda não foi concluída.");

    if (alvo.resgatada)
      throw new Error("Você já resgatou a recompensa dessa missão.");

    const economy = new Economy(this.userId, this.context);
    const log = await economy.add(alvo.recompensas.estrelas, {
      action: 'missao_recompensa',
      metadata: { motivo: `Missão: ${alvo.titulo}` }
    });

    alvo.resgatada = true;
    doc.markModified(grupoAlvo);
    await doc.save();

    return { missao: alvo, grupo: grupoAlvo, log };
  }

  async autocompleteResgatar(textoDigitado = '') {
    const doc = await this._getOrCreate();
    const busca = String(textoDigitado ?? '').toLowerCase();
    const opcoes = [];

    for (const grupo of GRUPOS) {
      for (const missao of doc[grupo].list) {
        if (!missao.concluida || missao.resgatada) continue;
        if (!missao.titulo.toLowerCase().includes(busca)) continue;

        opcoes.push({
          name: `${missao.titulo} (+${missao.recompensas.estrelas} Estrelas)`,
          value: missao.id
        });
      }
    }

    return opcoes.slice(0, 25);
  }

  static async progress(userId, context, acao, quantidade = 1) {
    try {
      if (!userId || !context?.guildId) return;
      const missions = new Missions(userId, context);
      await missions.registrarProgresso(acao, quantidade);
    } catch (err) {
      console.error('[Missions.progress]', err);
    }
  }
}

module.exports = Missions;
