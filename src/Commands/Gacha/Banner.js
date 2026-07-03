'use strict';

const MessageEmbed = require("../../function/Messages/EmbedBuild.js");
const DiscordRequest = require("../../function/DiscordRequest.js");
const ComponentBuilder = require("../../function/Messages/ComponentBuilder.js");

const GachaSystem = require("../../function/Gacha/Banners.js");
const config = require("../../function/Gacha/personagens.js");
const UserGlobalDb = require("../../Mongodb/userglobal.js");
const UserEconomy = require("../../function/Gacha/Economy.js");

const gacha = new GachaSystem(config);
const COST = 160;

const gifs = {
  "t31giro":    "https://files.catbox.moe/hlkrkx.gif",
  "t41giro":    "https://files.catbox.moe/f5r71d.gif",
  "t51giro":    "https://files.catbox.moe/1lesvg.gif",
  "t410giros":  "https://files.catbox.moe/fnb04r.gif",
  "t510giros":  "https://files.catbox.moe/5fyt7i.gif"
};

function getGif(results, amount) {
  const maior = results.reduce((max, r) => Math.max(max, r.tipo), 3);
  const key = `t${maior}${amount}${amount === 10 ? "giros" : "giro"}`;
  return gifs[key] ?? gifs.t31giro;
}

module.exports = {
  data: {
    name: "banner",
    description: "Gire nos banners e tente a sorte!",
    options: [
      {
        name: "tipo",
        description: "Escolha o banner",
        type: 3,
        required: true,
        choices: [
          { name: "Banner 1",    value: "0" },
          { name: "Banner 2",    value: "1" },
          { name: "Mochileiro",  value: "2" }
        ]
      }
    ]
  },

  async execute(interaction, client) {
    const e      = client.emoji;
    const userId   = interaction.member.user.id;
    const bannerId = Number(interaction.data.options[0].value);

    let user = await UserGlobalDb.findOne({ userId });
    if (!user) user = await UserGlobalDb.create({ userId });

    let pity = 0;
    let url;

    if (bannerId === 0) url = "https://files.catbox.moe/amg5l1.png";
    if (bannerId === 1) url = "https://files.catbox.moe/srtb8d.png";
    if (bannerId === 2) url = "https://static.wikia.nocookie.net/genshin-impact/images/7/7c/Ora%C3%A7%C3%A3o_Invoca%C3%A7%C3%A3o_do_Mochileiro_11-11-2020.png/revision/latest?cb=20220530024332&path-prefix=pt-br";

    if (bannerId === 0 || bannerId === 1) pity = user.primogemas.bannerlimitado.pityt5;
    if (bannerId === 2)                   pity = user.primogemas.mochileiro.pityt5;

    const garantido = user.primogemas.bannerlimitado.garantidot5 ? "Sim ⭐" : "Não";

    const embed = new MessageEmbed()
      .setTitle(`${e.animada} Banner Selecionado`)
      .setDescription(
        `${e.feliz} **Primogemas:** ${user.primogemas.atm} 🔮\n` +
        `${e.pensando} **Pity:** ${pity}/90\n` +
        `${e.corao} **Garantido:** ${garantido}\n\n` +
        `${e.sria} O banner se encerra <t:1782065760:R>`
      )
      .setColor(0xA9D6FF)
      .setImage(url)
      .build();

    const btn1 = client.interactions.createButton({
      user: userId,
      data: { label: "✨ 1 Giro", style: 1 },
      funcao: async (btn) => executarPull(btn, bannerId, 1, client)
    });

    const btn10 = client.interactions.createButton({
      user: userId,
      data: { label: "🌟 10 Giros", style: 3 },
      funcao: async (btn) => executarPull(btn, bannerId, 10, client)
    });

    await DiscordRequest(
      `/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: "POST",
        body: {
          type: 4,
          data: {
            embeds: [embed],
            components: [{ type: 1, components: [btn1, btn10] }]
          }
        }
      }
    );
  }
};

async function executarPull(interaction, bannerId, amount, client) {
  const e = client.emoji;

  await DiscordRequest(
    `/interactions/${interaction.id}/${interaction.token}/callback`,
    { method: "POST", body: { type: 6 } }
  );

  const userId = interaction.member.user.id;
  let user = await UserGlobalDb.findOne({ userId });
  if (!user) user = await UserGlobalDb.create({ userId });

  const custo = COST * amount;

  if (user.primogemas.atm < custo) {
    const embed = new MessageEmbed()
      .setTitle(`${e.emburrada} Primogemas insuficientes...`)
      .setDescription(
        `Poxa, você não tem Primogemas suficientes pra isso! ${e.chorando}\n\n` +
        `🔮 **Necessário:** ${custo}\n` +
        `💸 **Você tem:** ${user.primogemas.atm}`
      )
      .setColor(0xFF6B8A)
      .build();

    return await DiscordRequest(
      `/webhooks/${process.env.CLIENT_ID}/${interaction.token}/messages/@original`,
      { method: "PATCH", body: { embeds: [embed], components: [] } }
    );
  }

  const saldoAntes = user.primogemas.atm;
  user.primogemas.atm -= custo;

  if (!Array.isArray(user.primogemas.transacoes))
    user.primogemas.transacoes = [];

  user.primogemas.transacoes.push({
    type:        "banner_pull",
    value:       custo,
    amount,
    banner:      bannerId,
    banner_name: bannerId === 2 ? "Mochileiro" : config.banners.atual.t5[bannerId],
    date:        Date.now()
  });

  // Seção 8: teto do array, mesma correção do Economy.js — senão cresce
  // pra sempre pra quem gira muito.
  if (user.primogemas.transacoes.length > 100) {
    user.primogemas.transacoes = user.primogemas.transacoes.slice(-100);
  }

  let results = amount === 1
    ? [gacha.pull(user, bannerId)]
    : await gacha.multi(user, bannerId, 10);

  await user.save();

  // Seção 8: pull de gacha bypassava completamente o Economy.js — a moeda
  // era gasta e os personagens concedidos sem NENHUM log (nem webhook, nem
  // persistência). ⚠️ Assumido (conforme o prompt original) que o log de
  // economia cobre moeda + personagens de gacha juntos, já que o gasto e a
  // concessão acontecem na mesma ação.
  UserEconomy.log({
    userId:   userId,
    action:   "banner_pull",
    previous: saldoAntes,
    amount:   custo,
    current:  user.primogemas.atm,
    bannerId,
    characters: results.map(r => ({
      item:        r.item,
      tipo:        r.tipo,
      novo:        !!r.inventario?.novo,
      constelacao: r.inventario?.constelacao ?? 0,
    })),
  }).catch(err => console.error("[Banner] Falha ao logar pull de gacha:", err));

  const gif = getGif(results, amount);

  await DiscordRequest(
    `/webhooks/${process.env.CLIENT_ID}/${interaction.token}/messages/@original`,
    {
      method: "PATCH",
      body: {
        embeds: [
          new MessageEmbed()
            .setTitle(`${e.animada} Girando...`)
            .setImage(gif)
            .setColor(0x7C8FFF)
            .build()
        ],
        components: []
      }
    }
  );

  const texto = results.map(r => {
    let extra = "";
    if (r.inventario) {
      if (r.inventario.novo)             extra = `— ${e.festa} **Novo!**`;
      else if (r.inventario.constelacao) extra = `— ${e.curtida} C${r.inventario.constelacao}`;
    }
    return `${r.tipo === 5 ? e.corao : r.tipo === 4 ? e.feliz : e.default} **${r.tipo}⭐** ${r.item} ${extra}`;
  }).join("\n");

  const embed = new MessageEmbed()
    .setTitle(`${e.festa} Resultado dos Giros!`)
    .setDescription(
      `${e.pensando} **Gasto:** ${custo} 🔮\n` +
      `${e.animada} **Restante:** ${user.primogemas.atm} 🔮\n\n` +
      `${texto}`
    )
    .setColor(0xFFD966)
    .build();

  setTimeout(async () => {
    await DiscordRequest(
      `/webhooks/${process.env.CLIENT_ID}/${interaction.token}/messages/@original`,
      { method: "PATCH", body: { embeds: [embed] } }
    );
  }, 5000);
}