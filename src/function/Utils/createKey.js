const crypto = require("crypto");
const PremiumKey = require("../../Mongodb/premiumKey.js");

async function createKey(type, dias) {

  const code = "LUA-" + crypto.randomBytes(4).toString("hex").toUpperCase();

  const key = await PremiumKey.create({
    code,
    type,
    duration: dias * 86400000
  });

  return key.code;
}

module.exports = { createKey };