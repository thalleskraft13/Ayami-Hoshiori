'use strict';

const Economy      = require("./Economy.js");
const Missions     = require("./Missions.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");
const RECOMPENSAS  = require("./data/recompensasBiblioteca.js");

const TIPOS_PUBLICACAO = new Set(['publish_embed', 'publish_components_v2', 'publish_logic_engine']);
const ACAO_MISSAO_POR_TIPO = { download: 'receber_downloads', avaliacao: 'receber_avaliacoes' };

class LibraryRewards {

  static async conceder(userId, tipo, context = {}, metadataExtra = {}) {
    if (!userId) return null;

    const recompensa = RECOMPENSAS[tipo];
    if (!recompensa) return null;

    const economy = new Economy(userId, context);

    const log = await economy.add(recompensa.estrelas, {
      action: 'add',
      metadata: { motivo: recompensa.motivo, ...metadataExtra }
    });

    if (TIPOS_PUBLICACAO.has(tipo)) {
      await UserGlobalDb.updateOne(
        { userId },
        { $inc: { "estatisticas.criacoesPublicadas": 1 } }
      );
      await Missions.progress(userId, context, 'publicar', 1);
    }

    const acaoMissao = ACAO_MISSAO_POR_TIPO[tipo];
    if (acaoMissao) {
      await Missions.progress(userId, context, acaoMissao, 1);
    }

    return log;
  }
}

module.exports = LibraryRewards;
