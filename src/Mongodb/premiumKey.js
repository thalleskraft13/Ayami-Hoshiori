const { Schema, model } = require("mongoose");

const keySchema = new Schema({

  code: {
    type: String,
    unique: true
  },

  type: {
    type: String,
    enum: ["USER", "GUILD"],
    required: true
  },

  // Qual plano essa key concede quando type === "USER"
  // (FREE | NOVA_ESTRELA | LUA_CRESCENTE | CONSTELLATION). Ignorado pra type GUILD.
  // ⚠️ Sem `enum` de propósito — mesmo motivo dos outros schemas: não recusar
  // saves por causa de keys antigas gravadas com valor legado em minúsculo.
  plan: {
    type: String,
    default: "CONSTELLATION"
  },

  duration: {
    type: Number,
    required: true
  },

  used: {
    type: Boolean,
    default: false
  },

  usedBy: {
    type: String,
    default: null
  },

  usedAt: {
    type: Number,
    default: null
  }

});

module.exports = model("PremiumKey-Canary", keySchema);