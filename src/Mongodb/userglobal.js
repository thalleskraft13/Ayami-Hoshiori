const { Schema, model } = require("mongoose");

const userSchema = new Schema({

  userId: {
    type: String,
    required: true,
    unique: true
  },

  uidGenshin: {
    type: Number,
    default: 0
  },

  dmNotificacoes: {
    type: Boolean,
    default: false
  },

  server: {
    type: String,
    default: ""
  },

  premium: {
    type: Number,
    default: 0
  },

  premiumPlan: {
    type: String,
    default: null
  },

  premiumExpiresAt: {
    type: Number,
    default: 0
  },

  premium_guild_limit: {
    type: Number,
    default: 1
  },

  premium_guilds: {
    type: [{
      guildId: String,
      expireAt: Number
    }],
    default: []
  },

  // ================================
  // Economia da Ayami — Estrelas
  // ================================

  estrelas: {

    atm: {
      type: Number,
      default: 0
    },

    transacoes: {
      type: Array,
      default: []
    },

    dailyTempo: {
      type: Number,
      default: 0
    },

    // Impede que /estrelas migrar seja executado mais de uma vez por conta.
    migrado: {
      type: Boolean,
      default: false
    }

  },

  // Recursos são utilizados apenas para crafting/evolução (Oficina, Jardim, Exploração).
  // Estrutura livre para permitir novos recursos sem migração de schema.
  recursos: {
    type: Map,
    of: Number,
    default: () => ({
      madeira: 0,
      pedra: 0,
      ferro: 0,
      cristais: 0,
      flores: 0,
      livros: 0,
      reliquias: 0,
      cogumelos: 0,
      poeiraEstelar: 0
    })
  },

  // Reputação geral do usuário na comunidade da Ayami (Mercado, Biblioteca, Guildas...)
  reputacao: {
    type: Number,
    default: 0
  },

  conquistas: {
    type: [{
      id: {
        type: String,
        required: true
      },
      obtidoEm: {
        type: Number,
        default: Date.now
      }
    }],
    default: []
  },

  inventario: {

    itens: {
      type: [{
        itemId: String,
        quantidade: { type: Number, default: 1 },
        obtidoEm: { type: Number, default: Date.now }
      }],
      default: []
    },

    ferramentas: {
      type: [{
        itemId: String,
        durabilidade: { type: Number, default: 100 },
        obtidoEm: { type: Number, default: Date.now }
      }],
      default: []
    },

    decoracoes: {
      type: [{
        itemId: String,
        quantidade: { type: Number, default: 1 },
        obtidoEm: { type: Number, default: Date.now }
      }],
      default: []
    }

  },

  // Id do companheiro atualmente ativo (auxilia exploração/expedições/coleta)
  companheiroAtivo: {
    type: String,
    default: null
  },

  estatisticas: {

    exploracoesTotais: {
      type: Number,
      default: 0
    },

    expedicoesTotais: {
      type: Number,
      default: 0
    },

    itensFabricados: {
      type: Number,
      default: 0
    },

    criacoesPublicadas: {
      type: Number,
      default: 0
    },

    estrelasGanhasTotal: {
      type: Number,
      default: 0
    },

    estrelasGastasTotal: {
      type: Number,
      default: 0
    }

  },

  // ================================
  // Sistemas independentes da economia
  // ================================

  rankaventureiro: {

    xpTotal: {
      type: Number,
      default: 0
    },

    nivelAtual: {
      type: Number,
      default: 0
    },

    xpRestante: {
      type: Number,
      default: 1000
    }
  },

  missions: {
    daily:  { type: Object, default: () => ({}) },
    weekly: { type: Object, default: () => ({}) }
  }

});

module.exports = model("User Global", userSchema);
