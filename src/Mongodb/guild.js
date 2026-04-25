
const { Schema, model } = require("mongoose");

const ticketSchema = new Schema({

  panelId: { type: String, required: true },

  categoriaId: { type: String, default: null },
  canalId: { type: String, default: null },

  painelPrincipal: { type: Object, default: null },

  cargosStaff: { type: [String], default: [] },

  ticketChatName: { type: String, default: null }, // PREMIUM

  contadorTicket: { type: Number, default: 0 },

  tipoDeCriacao: {
    type: Number,
    enum: [0, 1, 2], // 0 = channel | 1 = thread public | 2 = thread private
    default: 0
  }

}, { _id: false });

const guildSchema = new Schema({

  guildId: { type: String, required: true, unique: true },

  premiumUser: { type: String, default: "0" },

  ticket: {
    type: [ticketSchema],
    default: []
  }

});

module.exports = model("Guild", guildSchema);