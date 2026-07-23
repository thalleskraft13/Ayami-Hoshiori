'use strict';

const { Schema, model } = require("mongoose");


const UserGuild = new Schema({
  userId:  { type: String, required: true },
  guildId: { type: String, required: true },

  birthday: {
    day:   { type: Number, default: null },   // 1–31
    month: { type: Number, default: null },   // 1–12
    year:  { type: Number, default: null },   // opcional — para calcular idade
    set:   { type: Boolean, default: false }  
  }
});

UserGuild.index({ guildId: 1, userId: 1 }, { unique: true });

UserGuild.index({ "birthday.day": 1, "birthday.month": 1 });

module.exports = model("UserGuild", UserGuild);
