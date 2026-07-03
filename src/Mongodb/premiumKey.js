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

  // Seção 2: qual plano essa key concede quando type === "USER"
  // (nova_estrela | lua_crescente | constellation). Ignorado pra type GUILD.
  plan: {
    type: String,
    default: "constellation"
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