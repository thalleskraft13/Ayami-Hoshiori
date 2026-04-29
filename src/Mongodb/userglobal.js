const { Schema, model } = require("mongoose");

const userSchema = new Schema({

  userId: {
    type: String,
    required: true,
    unique: true
  },

  premium: {
    type: Number,
    default: 0
  },

  /* ===============================
     💎 ECONOMIA
  =============================== */
  primogemas: {

    atm: {
      type: Number,
      default: 0
    },

    transacoes: [{
      tipo: String, // ex: "gacha", "daily", "admin"
      quantidade: Number,
      data: Number
    }],

    daily_tempo: {
      type: Number,
      default: 0
    },

    /* ===============================
       🎯 BANNER LIMITADO
    =============================== */
    bannerlimitado: {
      garantidot5: { type: Boolean, default: false },
      garantidot4: { type: Boolean, default: false },
      pityt5: { type: Number, default: 0 },
      pityt4: { type: Number, default: 0 }
    },

    /* ===============================
       🎒 MOCHILEIRO
    =============================== */
    mochileiro: {
      pityt5: { type: Number, default: 0 },
      pityt4: { type: Number, default: 0 }
    }
  },

  /* ===============================
     🎒 INVENTÁRIO DE PERSONAGENS
  =============================== */
  personagens: [{
    nome: String,
    raridade: String, // "4⭐" | "5⭐"
    constelacao: {
      type: Number,
      default: 0,
      max: 6
    }
  }]

});

module.exports = model("User Global", userSchema);