'use strict';

const { Schema, model } = require("mongoose");

const UserGuild = new Schema({
  userId:  { type: String, required: true },
  guildId: { type: String, required: true },

  birthday: {
    day:   { type: Number, default: null },
    month: { type: Number, default: null },
    year:  { type: Number, default: null },
    set:   { type: Boolean, default: false }
  }
});

UserGuild.index({ guildId: 1, userId: 1 }, { unique: true });

UserGuild.index({ "birthday.day": 1, "birthday.month": 1 });

module.exports = model("UserGuild", UserGuild);
